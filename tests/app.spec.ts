import { expect, test } from '@playwright/test'

test('mobile workflow updates solutions when a transaction is disabled', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New game' }).click()

  await expect(page.getByRole('heading', { name: 'New game' })).toBeVisible()

  await page.getByRole('button', { name: 'Add player' }).click()
  await page.getByLabel('Player 6 name').fill('Frank')
  await page.getByRole('button', { name: 'Seat 3 fixed color: Unknown' }).click()

  await page.getByRole('button', { name: 'Transactions' }).click()
  await page.getByRole('link', { name: 'Add transaction' }).click()
  await page.getByLabel('Signed weight').fill('2')
  await page.getByRole('button', { name: 'Save transaction' }).click()

  await page.getByRole('link', { name: 'Add transaction' }).click()
  await page.getByRole('button', { name: 'Conditional' }).click()
  await page.getByLabel('Conditioning player').selectOption({
    label: 'Player 3 (#3)',
  })
  await page.getByLabel('Player i').selectOption({
    label: 'Player 1 (#1)',
  })
  await page.getByLabel('Player j').selectOption({
    label: 'Player 2 (#2)',
  })
  await page.getByLabel('Equation signed weight').fill('-2')
  await page.getByRole('button', { name: 'Save transaction' }).click()

  await page.getByRole('button', { name: 'Solutions' }).click()
  const firstSolutionBefore = await page.getByText(/Fitness /).first().textContent()

  await page.getByRole('button', { name: 'Transactions' }).click()
  const dyadicRow = page.locator('article').filter({
    hasText: 'Player 1 → Player 2, w = +2',
  })
  await dyadicRow.getByLabel('Enabled').uncheck()

  await page.getByRole('button', { name: 'Solutions' }).click()
  const firstSolutionAfter = await page.getByText(/Fitness /).first().textContent()

  expect(firstSolutionAfter).not.toEqual(firstSolutionBefore)
})

test('game export triggers a download', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New game' }).click()
  await page.getByRole('link', { name: '← Back to games' }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/\.json$/)
})

test('setup stays mobile-friendly', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New game' }).click()

  const playerNameInput = page.getByLabel('Player 1 name')
  await expect(playerNameInput).toHaveCSS('font-size', '16px')
  await expect(page.getByText('Allowed blue totals (inclusive): 0-5')).toBeVisible()

  await page.getByRole('button', { name: 'Add player' }).click()

  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1)
})
