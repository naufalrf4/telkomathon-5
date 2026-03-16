import { expect, test } from '@playwright/test';

const syllabusId = 'test-syllabus-id';
const mockSyllabus = {
  id: syllabusId,
  topic: 'Pemrograman Web Dasar',
  target_level: 2,
  tlo: 'Mahasiswa mampu membangun antarmuka web sederhana.',
  elos: [
    {
      id: 'elo-1',
      title: 'HTML Dasar',
      description: 'Memahami struktur dokumen HTML.',
      pce: 'Menjelaskan struktur HTML.',
    },
  ],
  journey: {
    pre_learning: ['Membaca materi HTML.'],
    classroom: ['Praktik membuat halaman sederhana.'],
    after_learning: ['Menyempurnakan latihan mandiri.'],
  },
  status: 'completed',
  created_at: '2026-03-12T00:00:00Z',
  updated_at: '2026-03-12T01:00:00Z',
};

test.beforeEach(async ({ page }) => {
  await page.route(`**/api/v1/syllabi/${syllabusId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockSyllabus }),
    });
  });

  await page.addInitScript(() => {
    const openCalls: string[] = [];
    Object.defineProperty(window, '__openCalls', {
      value: openCalls,
      writable: false,
    });

    window.open = ((url?: string | URL) => {
      openCalls.push(String(url));
      return null;
    }) as typeof window.open;
  });
});

test('exports docx from syllabus detail through export screen', async ({ page }) => {
  await page.goto(`/syllabus/${syllabusId}`);

  await expect(page.getByText('Pemrograman Web Dasar')).toBeVisible();
  await page.getByText('Ekspor DOCX', { exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/export/${syllabusId}$`));
  await expect(page.getByText('Ekspor Silabus', { exact: true })).toBeVisible();
  await expect(page.getByText('Format DOCX', { exact: true })).toBeVisible();

  await page.getByText('Unduh DOCX', { exact: true }).click();

  const openCalls = await page.evaluate(() => {
    return (window as typeof window & { __openCalls: string[] }).__openCalls;
  });

  expect(openCalls).toHaveLength(1);
  expect(openCalls[0]).toContain(`/api/v1/syllabi/${syllabusId}/download.docx`);
});
