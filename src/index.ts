import puppeteer, { Page } from 'puppeteer';
import dotenv from 'dotenv';
import config from './config/environment.js';

dotenv.config();

// Replace with your SOCKS proxy
const proxy = process.env.TOR_PROXY_URI;

const browser = await puppeteer.launch({
  headless: false, // or true
  // args: [`--proxy-server=${proxy}`],
});

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const withClassName = (className: string): string =>
  `contains(concat(' ', normalize-space(@class), ' '), ' ${className} ')`;

const ticketOptionXPath = (ticketDescription: string) =>
  `//li[${withClassName('ticket-choice')}]/div[${withClassName('ticket-info')}]/span[contains(normalize-space(.), '${ticketDescription}')]`;

const getAvailableSpots = async (
  page: Page,
  ticketDescription: string,
): Promise<number> => {
  const ticketSelector = ticketOptionXPath(ticketDescription);
  await page.waitForSelector(`::-p-xpath(${ticketSelector})`);
  const ticketAvailabilityXPath =
    ticketSelector + `/small[contains(normalize-space(.), 'verfügbar')]`;
  const innerAvailable = await page
    .locator(`::-p-xpath(${ticketAvailabilityXPath})`)
    .map((small) => small.innerHTML)
    .wait();

  const parts = innerAvailable.match(/<\/translate>: (\d+) </);
  return parseInt(parts && parts.length >= 2 ? parts[1] : '-1');
};

const selectTicket = async (page: Page, title: string) => {
  const ticketSelector = ticketOptionXPath(title);
  await page.locator(`::-p-xpath(${ticketSelector})`).click();
};

const getFormFieldXPathWrapperTemplate = (
  wrapperTagWithConditionStart: string,
  tag: string,
  label: string,
) =>
  `::-p-xpath(//${wrapperTagWithConditionStart}label[contains(normalize-space(.), '${label}')]]//${tag})`;
const getFormFieldXPathByWrapper = (
  wrapperTag: string,
  tag: string,
  label: string,
) => getFormFieldXPathWrapperTemplate(`${wrapperTag}[`, tag, label);
const getFormFieldXPathByWrapperWithCondition = (
  wrapperTag: string,
  condition: string,
  tag: string,
  label: string,
) =>
  getFormFieldXPathWrapperTemplate(
    `${wrapperTag}[${condition} and `,
    tag,
    label,
  );
const getFormFieldXPath = (tag: string, label: string) =>
  getFormFieldXPathByWrapper('md-input-container', tag, label);
const fillTag = async (
  tag: string,
  page: Page,
  label: string,
  value: string,
) => {
  await page.locator(getFormFieldXPath(tag, label)).fill(value);
};
const fillInput = async (page: Page, label: string, value: string) => {
  await fillTag('input', page, label, value);
};
const fillTextArea = async (page: Page, label: string, value: string) => {
  await fillTag('textarea', page, label, value);
};
const selectOption = async (page: Page, label: string, value: string) => {
  await page.locator(getFormFieldXPath('md-select', label)).click();
  await page
    .locator(
      `::-p-xpath(//md-select-menu/md-content/md-option[div[${withClassName('md-text')} and contains(normalize-space(.), '${value}')]])`,
    )
    .click();
};
const tickOption = async (page: Page, label: string) => {
  await page
    .locator(
      `::-p-xpath(//div[${withClassName('agreements')}]//div[div/span[contains(normalize-space(.), '${label}')]]/div[${withClassName('switcher')}])`,
    )
    .click();
};

const action = async () => {
  const page = await browser.newPage();
  await page.setViewport({
    width: 1280,
    height: 720,
  });

  // visit the website and wait for it to load
  await page.goto(config.WEBSITE_URL, {
    waitUntil: 'networkidle2',
  });

  const signUpButtonXPath = `//span[${withClassName('event-actions-desktop')}]//a[contains(text(), 'Jetzt anmelden')]`;
  await page
    .locator(`::-p-xpath(${signUpButtonXPath})`)
    .setTimeout(3000)
    .click();

  const availableSpotsWithAccomodation = await getAvailableSpots(
    page,
    'Ticket mit Übernachtung',
  );
  const availableSpotsWithoutAccomodation = await getAvailableSpots(
    page,
    'Ticket ohne Übernachtung',
  );

  console.log(`
    Tickets with accomodation: ${availableSpotsWithAccomodation}
    Tickets without accomodation: ${availableSpotsWithoutAccomodation}
  `);

  // if (availableSpotsWithAccomodation === 0) return;

  await selectTicket(page, 'Ticket mit Übernachtung');

  // fill out form
  await fillInput(page, 'E-Mail', config.PARTICIPANT_DATA.email);
  await fillInput(page, 'E-Mail (Wiederholung)', config.PARTICIPANT_DATA.email);
  await fillInput(page, 'Vorname', config.PARTICIPANT_DATA.firstName);
  await fillInput(page, 'Nachname', config.PARTICIPANT_DATA.lastName);
  await page.focus(
    `::-p-xpath(//cp-datepicker[@label-date='Geburtstag']//input)`,
  );
  await page.keyboard.type(config.PARTICIPANT_DATA.birthDate, {
    delay: 100,
  });
  await selectOption(page, 'Geschlecht', config.PARTICIPANT_DATA.gender);
  await fillInput(page, 'Telefonnummer', config.PARTICIPANT_DATA.phone);
  await fillInput(page, 'Gemeinde', config.PARTICIPANT_DATA.ward);
  await fillInput(page, 'Pfahl', config.PARTICIPANT_DATA.stake);
  await fillInput(page, 'Mitgliedsnummer', config.PARTICIPANT_DATA.memberId);
  await fillTextArea(
    page,
    'Gibt es eine Person',
    config.PARTICIPANT_DATA.roomMates,
  );
  await selectOption(
    page,
    'Deine Verpflegung',
    config.PARTICIPANT_DATA.foodPreference,
  );

  // tick agreements
  await tickOption(
    page,
    'überweise ich den Tagungsbeitrag auf das angegebene Konto',
  );
  await tickOption(
    page,
    'Zweck der Erhebung und Verwendung meiner personenbezogenen Daten',
  );
  await tickOption(
    page,
    'Die Widerrufsinformationen habe ich zur Kenntnis genommen',
  );

  await page
    .locator(
      `::-p-xpath(//button[@type='submit' and contains(normalize-space(.), 'Jetzt kaufen')])`,
    )
    .click();

  // wait for billing page to load
  await page.waitForSelector(getFormFieldXPath('input', 'Rechnungsempfänger'));

  await fillInput(
    page,
    'Straße',
    config.PARTICIPANT_DATA.billingAddress.streetName,
  );
  await fillInput(
    page,
    'Nr.',
    config.PARTICIPANT_DATA.billingAddress.houseNumber,
  );
  await fillInput(page, 'PLZ', config.PARTICIPANT_DATA.billingAddress.zipCode);
  await fillInput(page, 'Ort', config.PARTICIPANT_DATA.billingAddress.cityName);
  await page
    .locator(`::-p-xpath(//button[contains(normalize-space(.), 'Weiter')])`)
    .click();

  await page
    .locator(
      getFormFieldXPathByWrapper(
        `div[${withClassName('stripeLike')}]`,
        'input',
        'Karteninhaber',
      ),
    )
    .fill(config.PARTICIPANT_DATA.paymentData.cardHolder);

  // fill out the iframe
  let iframeHandle = await page.waitForSelector(
    `::-p-xpath(//iframe[@title='Sicherer Eingaberahmen für Zahlungen'])`,
  );
  if (!iframeHandle) throw 'Could not find stripe iframe!';
  const stripeIFrame = await iframeHandle.contentFrame();
  if (!stripeIFrame) throw 'Could not get the stripe content frame!';

  await stripeIFrame
    .waitForSelector(
      getFormFieldXPathByWrapperWithCondition(
        'div',
        `@data-field='number'`,
        'input',
        'Kartennummer',
      ),
    )
    .fill(config.PARTICIPANT_DATA.paymentData.cardNumber);
  await stripeIFrame
    .locator(
      getFormFieldXPathByWrapperWithCondition(
        'div',
        `@data-field='expiry'`,
        'input',
        'Ablaufdatum',
      ),
    )
    .fill(config.PARTICIPANT_DATA.paymentData.expiryDate);
  await stripeIFrame
    .locator(
      getFormFieldXPathByWrapperWithCondition(
        'div',
        `@data-field='cvc'`,
        'input',
        'Sicherheitscode',
      ),
    )
    .fill(config.PARTICIPANT_DATA.paymentData.expiryDate);

  // await page
  //   .locator(
  //     `::-p-xpath(//button[contains(normalize-space(.), 'Jetzt bezahlen')])`,
  //   )
  //   .click();

  await new Promise((resolve) => setTimeout(resolve, 30000));
};

(async () => {
  try {
    await action();
  } catch (error) {
    console.error(error);
  } finally {
    await browser.close();
  }
})();
