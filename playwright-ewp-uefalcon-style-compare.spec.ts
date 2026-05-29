import { test, expect } from '@playwright/test';

type CssSnapshot = Record<string, string>;

const CSS_PROPERTIES = [
  'border',
  'border-color',
  'border-width',
  'border-radius',
  'background-color',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'padding',
  'margin',
  'outline',
  'box-shadow',
] as const;

async function authenticateAndOpen(page: import('@playwright/test').Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function getVisibleField(page: import('@playwright/test').Page) {
  const fields = page.locator('input:not([type="hidden"]), textarea, select');
  const count = await fields.count();

  for (let index = 0; index < count; index += 1) {
    const candidate = fields.nth(index);
    const box = await candidate.boundingBox().catch(() => null);
    if (box && box.width > 0 && box.height > 0) {
      return candidate;
    }
  }

  throw new Error('No visible input field found');
}

async function getVisibleSubmitButton(page: import('@playwright/test').Page) {
  const buttons = page.getByRole('button', { name: /submit/i });
  const count = await buttons.count();

  for (let index = 0; index < count; index += 1) {
    const candidate = buttons.nth(index);
    const box = await candidate.boundingBox().catch(() => null);
    if (box && box.width > 0 && box.height > 0) {
      return candidate;
    }
  }

  return null;
}

async function captureCssSnapshot(locator: import('@playwright/test').Locator): Promise<CssSnapshot> {
  return locator.evaluate((element, properties) => {
    const styles = getComputedStyle(element);
    const snapshot: Record<string, string> = {};

    for (const property of properties as readonly string[]) {
      snapshot[property] = styles.getPropertyValue(property).trim();
    }

    return snapshot;
  }, CSS_PROPERTIES as unknown as string[]);
}

async function captureFieldState(page: import('@playwright/test').Page, imagePath: string) {
  const field = await getVisibleField(page);
  const submit = await getVisibleSubmitButton(page);

  await field.scrollIntoViewIfNeeded();
  const snapshot = await captureCssSnapshot(field);
  await field.screenshot({ path: imagePath });

  return { field, submit, snapshot };
}

async function triggerValidationError(
  page: import('@playwright/test').Page,
  field: import('@playwright/test').Locator,
  submit: import('@playwright/test').Locator | null,
) {
  if (submit) {
    await submit.click();
  } else {
    await field.blur().catch(() => {});
    await page.keyboard.press('Tab').catch(() => {});
  }

  await page.waitForTimeout(1200);
}

test('compare EWP and UEFalcon form field styling across default, focus, error, and error-focus states', async ({ page }) => {
  const credentialsUrl = (url: string) =>
    url.replace('https://', 'https://aem_cloud_qa:AEM-Qa%405463@');

  const ewpUrl = credentialsUrl(
    'https://legal-tr-com-qa-cs.ewp.thomsonreuters.com/en/ewp-qa/mohan_test/form_test/fl-ewp-legacy-redirect0',
  );
  const uefalconUrl = credentialsUrl(
    'https://legal-tr-com-qa-cs.ewp.thomsonreuters.com/en/ewp-qa/mohan_test/form_test/743226-forms-recaptcha/ue-flacon-fl-apigee-redirect',
  );

  const results: Record<'ewp' | 'uefalcon', Record<string, CssSnapshot>> = {
    ewp: {},
    uefalcon: {},
  };

  await authenticateAndOpen(page, ewpUrl);

  let field = await getVisibleField(page);
  let submit = await getVisibleSubmitButton(page);

  await field.scrollIntoViewIfNeeded();
  results.ewp.default = await captureCssSnapshot(field);
  await field.screenshot({ path: 'ewp-default.png' });

  await field.click();
  results.ewp.focus = await captureCssSnapshot(field);
  await field.screenshot({ path: 'ewp-focus.png' });

  await triggerValidationError(page, field, submit);
  results.ewp.error = await captureCssSnapshot(field);
  await field.screenshot({ path: 'ewp-error.png' });

  await field.click();
  results.ewp['error-focus'] = await captureCssSnapshot(field);
  await field.screenshot({ path: 'ewp-error-focus.png' });

  await authenticateAndOpen(page, uefalconUrl);

  field = await getVisibleField(page);
  submit = await getVisibleSubmitButton(page);

  await field.scrollIntoViewIfNeeded();
  results.uefalcon.default = await captureCssSnapshot(field);
  await field.screenshot({ path: 'uefalcon-default.png' });

  await field.click();
  results.uefalcon.focus = await captureCssSnapshot(field);
  await field.screenshot({ path: 'uefalcon-focus.png' });

  await triggerValidationError(page, field, submit);
  results.uefalcon.error = await captureCssSnapshot(field);
  await field.screenshot({ path: 'uefalcon-error.png' });

  await field.click();
  results.uefalcon['error-focus'] = await captureCssSnapshot(field);
  await field.screenshot({ path: 'uefalcon-error-focus.png' });

  const states = ['default', 'focus', 'error', 'error-focus'] as const;
  const rows: Array<{ state: string; cssProperty: string; ewpValue: string; uefalconValue: string; match: string }> = [];

  for (const state of states) {
    for (const property of CSS_PROPERTIES) {
      const ewpValue = results.ewp[state][property];
      const uefalconValue = results.uefalcon[state][property];
      rows.push({
        state,
        cssProperty: property,
        ewpValue,
        uefalconValue,
        match: ewpValue === uefalconValue ? 'Yes' : 'No',
      });
    }
  }

  console.table(rows);
  expect(rows.some((row) => row.match === 'No')).toBeTruthy();
});
