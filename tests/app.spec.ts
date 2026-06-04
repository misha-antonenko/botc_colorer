import { expect, test } from '@playwright/test'

test('mobile workflow updates solutions when a transaction is disabled', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New game' }).click()

  await expect(page.getByRole('heading', { name: 'Game 1' })).toBeVisible()

  await page.getByRole('button', { name: 'Add player' }).click()
  await page.getByLabel('Player 6 name').fill('Frank')

  // Rename players to avoid space-in-name issues with prefix resolution
  await page.getByLabel('Player 1 name').fill('Alice')
  await page.getByLabel('Player 2 name').fill('Bob')
  await page.getByLabel('Player 3 name').fill('Carol')

  await page.getByRole('button', { name: 'Transactions' }).click()

  // Add a hard constraint: Carol is blue
  await page.getByRole('link', { name: 'Add transaction' }).click()
  await page.getByLabel('Formula').fill('~C')
  await page.getByRole('button', { name: 'Toggle hard constraint' }).click()
  await page.getByRole('button', { name: 'Save transaction' }).click()

  // Add a soft formula: Alice same color as Bob
  await page.getByRole('link', { name: 'Add transaction' }).click()
  const weightInput = page.getByLabel('Weight')
  await expect(weightInput).toHaveCSS('font-size', '16px')
  await weightInput.fill('2')
  await page.getByLabel('Formula').fill('Al = Bob')
  await page.getByLabel('Note').fill('Clockmaker info')
  await page.getByRole('button', { name: 'Save transaction' }).click()

  // Add an implication: if Carol is blue then Alice differs from Bob
  await page.getByRole('link', { name: 'Add transaction' }).click()
  await page.getByLabel('Formula').fill('~C => (Al ^ Bob)')
  await page.getByLabel('Weight').fill('2')
  await page.getByRole('button', { name: 'Save transaction' }).click()

  await page.getByRole('button', { name: 'Solutions' }).click()
  const firstSolutionBefore = await page.getByText(/Fitness = /).first().textContent()

  await page.getByRole('button', { name: 'Transactions' }).click()
  const formulaRow = page.locator('article').filter({
    hasText: 'Alice = Bob',
  })
  await expect(formulaRow.getByText('Clockmaker info')).toBeVisible()
  await formulaRow.getByLabel('Enabled').uncheck()

  await page.getByRole('button', { name: 'Solutions' }).click()
  const firstSolutionAfter = await page.getByText(/Fitness = /).first().textContent()

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
  const blueCountMinimumInput = page.getByLabel('Blue count minimum')
  await expect(playerNameInput).toHaveCSS('font-size', '16px')
  await expect(blueCountMinimumInput).toHaveCSS('font-size', '16px')
  await expect(page.getByText('Shifts automatically when players are added or removed.')).toBeVisible()
  await expect(page.getByText(/Allowed blue totals/i)).toHaveCount(0)
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /maximum-scale=1\.0/,
  )

  await page.getByRole('button', { name: 'Add player' }).click()

  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1)
})
