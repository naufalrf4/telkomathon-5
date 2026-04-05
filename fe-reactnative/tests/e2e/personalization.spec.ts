import { expect, test, type Page, type Route } from '@playwright/test';

function success<T>(data: T) {
  return {
    status: 'success',
    data,
  };
}

function buildJourney() {
  return {
    pre_learning: { duration: '30 menit', method: ['Reading'], description: 'Pra-belajar', content: ['Artikel pengantar'] },
    classroom: { duration: '120 menit', method: ['Workshop'], description: 'Sesi kelas', content: ['Latihan praktik'] },
    after_learning: { duration: '45 menit', method: ['Assignment'], description: 'Tindak lanjut', content: ['Refleksi'] },
  };
}

function buildSyllabus(id: string, title: string) {
  return {
    id,
    topic: title,
    target_level: 3,
    course_expertise_level: 'Menengah',
    course_category: 'Teknologi',
    client_company_name: 'PRIMA Labs',
    course_title: title,
    company_profile_summary: 'Ringkasan perusahaan',
    commercial_overview: 'Commercial overview',
    tlo: `TLO ${title}`,
    performance_result: 'Mampu menerapkan praktik inti.',
    condition_result: 'Dengan studi kasus terarah.',
    standard_result: 'Dengan kualitas sesuai rubrik.',
    elos: [{ elo: 'Memahami konsep utama' }],
    journey: buildJourney(),
    revision_history: [],
    status: 'finalized',
    created_at: '2026-04-05T10:00:00Z',
    updated_at: '2026-04-05T10:00:00Z',
  };
}

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installPersonalizationMocks(page: Page): Promise<void> {
  const syllabus = buildSyllabus('syllabus-1', 'Syllabus Personalisasi');
  let bulkResults: Array<{
    id: string;
    syllabus_id: string;
    bulk_session_id: string | null;
    participant_name: string;
    revision_index: number;
    competency_gaps: Array<{
      skill: string;
      current_level: number;
      required_level: number;
      gap_description: string;
    }>;
    recommendations: Array<{
      type: string;
      title: string;
      description: string;
      estimated_duration_minutes: number;
      priority: number;
    }>;
    created_at: string;
  }> = [];

  await page.addInitScript(() => {
    window.localStorage.setItem('prima.auth.accessToken', 'token-personalize');
  });

  await page.route('**/api/v1/auth/me', async (route) => {
    await fulfillJson(
      route,
      success({ id: 'user-1', email: 'owner@prima.test', full_name: 'Owner PRIMA' })
    );
  });

  await page.route('**/api/v1/design-sessions/', async (route) => {
    await fulfillJson(route, success({ sessions: [], total: 0 }));
  });

  await page.route('**/api/v1/syllabi/', async (route) => {
    await fulfillJson(route, success({ syllabi: [syllabus], total: 1 }));
  });

  await page.route('**/api/v1/syllabi/syllabus-1', async (route) => {
    await fulfillJson(route, success(syllabus));
  });

  await page.route('**/api/v1/personalize/syllabus-1', async (route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, success(null));
      return;
    }

    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'LLM personalization unavailable', status: 'error', code: 'ai_service_error' }),
    });
  });

  await page.route('**/api/v1/personalize/syllabus-1/bulk', async (route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, success({ results: bulkResults, total: bulkResults.length }));
      return;
    }

    bulkResults = [
      {
        id: 'bulk-result-1',
        syllabus_id: 'syllabus-1',
        bulk_session_id: 'bulk-session-1',
        participant_name: 'Aulia Rahman',
        revision_index: 0,
        competency_gaps: [
          {
            skill: 'Python for ML',
            current_level: 1,
            required_level: 3,
            gap_description: 'Belum konsisten membaca dataset',
          },
        ],
        recommendations: [
          {
            type: 'practice',
            title: 'Latihan Python',
            description: 'Perkuat notebook dasar.',
            estimated_duration_minutes: 45,
            priority: 2,
          },
        ],
        created_at: '2026-04-05T11:00:00Z',
      },
    ];

    await fulfillJson(route, success({ syllabus_id: 'syllabus-1', bulk_session_id: 'bulk-session-1', total_participants: 1, results: bulkResults }));
  });
}

test('personalization hub exposes retained single-user and multi-user entry points', async ({ page }) => {
  await installPersonalizationMocks(page);

  await page.goto('/personalize');

  await expect(page).toHaveURL('/personalize');
  await expect(page.getByText('Buat rekomendasi belajar dari kurikulum final')).toBeVisible();
  await expect(page.getByText('Syllabus Personalisasi', { exact: true })).toBeVisible();
  await expect(page.getByText('Satu peserta', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Banyak peserta', { exact: true }).first()).toBeVisible();
});

test('selected personalization entry keeps single-user and multi-user choice inside personalization page', async ({ page }) => {
  await installPersonalizationMocks(page);

  await page.goto('/personalize?syllabusId=syllabus-1');

  await expect(page.getByText('Pilih mode personalisasi')).toBeVisible();
  await expect(page.getByText('Satu peserta', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Banyak peserta', { exact: true }).first()).toBeVisible();
});

test('single-user personalization surfaces backend failure to the user', async ({ page }) => {
  await installPersonalizationMocks(page);

  await page.goto('/personalize/syllabus-1');

  await page.getByPlaceholder('Contoh: Aulia Rahman').fill('Aulia Rahman');
  await page.getByPlaceholder('contoh: Pemrograman Python Lanjutan').fill('Python for ML');
  await page.getByText('Buat rekomendasi', { exact: true }).click();

  await expect(page.getByText('Personalisasi belum berhasil dibuat')).toBeVisible();
  await expect(page.getByText('LLM personalization unavailable')).toBeVisible();
});

test('bulk personalization renders generated run results', async ({ page }) => {
  await installPersonalizationMocks(page);

  await page.goto('/personalize/syllabus-1/bulk');

  await expect(page.getByText('Belum ada hasil batch')).toBeVisible();
  await page.getByPlaceholder('participant_name,skill,current_level,required_level,gap_description').fill(
    'participant_name,skill,current_level,required_level,gap_description\nAulia Rahman,Python for ML,1,3,Belum konsisten membaca dataset'
  );
  await page.getByText('Buat rekomendasi', { exact: true }).click();

  await expect(page.getByText('Hasil batch terbaru')).toBeVisible();
  await expect(page.getByText('Aulia Rahman', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Latihan Python', { exact: true }).last()).toBeVisible();
});
