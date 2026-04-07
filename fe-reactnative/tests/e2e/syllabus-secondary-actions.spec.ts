import { expect, test, type Page, type Route } from '@playwright/test';

type SyllabusFixture = {
  id: string;
  topic: string;
  target_level: number;
  course_expertise_level: string;
  course_category: string;
  client_company_name: string;
  course_title: string;
  company_profile_summary: string;
  commercial_overview: string;
  tlo: string;
  performance_result: string;
  condition_result: string;
  standard_result: string;
  elos: Array<{ elo: string }>;
  journey: {
    pre_learning: { duration: string; method: string[]; description: string; content: string[] };
    classroom: { duration: string; method: string[]; description: string; content: string[] };
    after_learning: { duration: string; method: string[]; description: string; content: string[] };
  };
  revision_history: Array<{
    tlo: string;
    performance_result: string;
    condition_result: string;
    standard_result: string;
    elos: Array<{ elo: string }>;
    journey: SyllabusFixture['journey'];
    revised_at: string;
    summary: string;
    reason: string;
    source_message_id: null;
    applied_fields: string[];
  }>;
  status: string;
  created_at: string;
  updated_at: string;
};

function success<T>(data: T) {
  return { status: 'success', data };
}

function buildSyllabus(): SyllabusFixture {
  return {
    id: 'syllabus-1',
    topic: 'Syllabus Detail',
    target_level: 3,
    course_expertise_level: 'Menengah',
    course_category: 'Teknologi',
    client_company_name: 'PRIMA Labs',
    course_title: 'Syllabus Detail',
    company_profile_summary: 'Ringkasan perusahaan',
    commercial_overview: 'Commercial overview',
    tlo: 'TLO awal',
    performance_result: 'Performance awal',
    condition_result: 'Condition awal',
    standard_result: 'Standard awal',
    elos: [{ elo: 'Modul awal' }],
    journey: {
      pre_learning: { duration: '30 menit', method: ['Reading'], description: 'Pra-belajar', content: ['Artikel pengantar'] },
      classroom: { duration: '120 menit', method: ['Workshop'], description: 'Sesi kelas', content: ['Latihan praktik'] },
      after_learning: { duration: '45 menit', method: ['Assignment'], description: 'Tindak lanjut', content: ['Refleksi'] },
    },
    revision_history: [],
    status: 'finalized',
    created_at: '2026-04-05T10:00:00Z',
    updated_at: '2026-04-05T10:00:00Z',
  };
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installSyllabusMocks(page: Page) {
  let syllabus = buildSyllabus();

  await page.addInitScript(() => {
    window.localStorage.setItem('prima.auth.accessToken', 'token-syllabus');
  });

  await page.route('**/api/v1/auth/me', async (route) => {
    await fulfillJson(route, success({ id: 'user-1', email: 'owner@prima.test', full_name: 'Owner PRIMA' }));
  });

  await page.route('**/api/v1/syllabi/syllabus-1', async (route) => {
    await fulfillJson(route, success(syllabus));
  });

  await page.route('**/api/v1/syllabi/syllabus-1/apply-revision', async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    syllabus = {
      ...syllabus,
      tlo: String(payload.tlo ?? syllabus.tlo),
      revision_history: [
        ...syllabus.revision_history,
        {
          tlo: syllabus.tlo,
          performance_result: syllabus.performance_result,
          condition_result: syllabus.condition_result,
          standard_result: syllabus.standard_result,
          elos: syllabus.elos,
          journey: syllabus.journey,
          revised_at: '2026-04-05T12:00:00Z',
          summary: String(payload.summary ?? ''),
          reason: String(payload.reason ?? ''),
          source_message_id: null,
          applied_fields: ['tlo'],
        },
      ],
    };
    await fulfillJson(route, success(syllabus));
  });

  await page.route('**/api/v1/syllabi/syllabus-1/download.docx', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      body: Buffer.from('PK-mock-docx'),
    });
  });
}

test('syllabus detail centralizes personalize, revision, and export actions', async ({ page }) => {
  await installSyllabusMocks(page);
  await page.goto('/syllabus/syllabus-1');

  await expect(page.getByText('Personalisasi', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Revisi', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Export DOCX', { exact: true })).toBeVisible();
  await expect(page.getByText('Satu peserta')).toHaveCount(0);
  await expect(page.getByText('Banyak peserta')).toHaveCount(0);
});

test('revision workspace applies syllabus changes and shows success state', async ({ page }) => {
  await installSyllabusMocks(page);
  await page.goto('/syllabus/syllabus-1/revision');

  await page.getByPlaceholder('Contoh: Menajamkan target performa').fill('Perbaikan tujuan akhir');
  await page.locator('textarea').nth(1).fill('TLO hasil revisi');
  await page.getByText('Simpan revisi').last().click();

  await expect(page.getByText('Revisi berhasil disimpan', { exact: true })).toBeVisible();
  await expect(page.getByText('Detail kurikulum sudah diperbarui.')).toBeVisible();
});

test('final syllabus export downloads docx directly', async ({ page }) => {
  await installSyllabusMocks(page);
  await page.goto('/syllabus/syllabus-1');

  const responsePromise = page.waitForResponse('**/api/v1/syllabi/syllabus-1/download.docx');
  await page.getByText('Export DOCX', { exact: true }).click();
  const response = await responsePromise;

  await expect(response.ok()).toBeTruthy();
  await expect(page.getByText('Export DOCX siap')).toBeVisible();
});
