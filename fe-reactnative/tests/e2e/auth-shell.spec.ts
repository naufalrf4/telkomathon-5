import { expect, test, type Page, type Route } from '@playwright/test';

type AuthUser = {
  id: string;
  email: string;
  full_name: string;
};

type SyllabusSummary = {
  id: string;
  topic: string;
  target_level: number;
  course_expertise_level: string;
  course_category: string | null;
  client_company_name: string | null;
  course_title: string | null;
  company_profile_summary: string | null;
  commercial_overview: string | null;
  tlo: string;
  performance_result: string | null;
  condition_result: string | null;
  standard_result: string | null;
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
    journey: SyllabusSummary['journey'];
    revised_at: string;
    summary: string;
    reason: string;
    source_message_id: string | null;
    applied_fields: string[];
  }>;
  status: string;
  created_at: string;
  updated_at: string;
};

function success<T>(data: T) {
  return {
    status: 'success',
    data,
  };
}

function buildSyllabus(id: string, title: string): SyllabusSummary {
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

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installStatefulAuthMocks(page: Page): Promise<void> {
  let currentUser: AuthUser = {
    id: 'user-a',
    email: 'alpha@prima.test',
    full_name: 'Alpha User',
  };
  let currentToken = 'token-alpha';
  let currentSyllabi = [buildSyllabus('syllabus-a', 'Alpha Syllabus')];

  await page.route('**/api/v1/auth/me', async (route) => {
    const authHeader = route.request().headers().authorization;
    if (authHeader !== `Bearer ${currentToken}`) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Unauthorized', status: 'error', code: 'unauthorized' }),
      });
      return;
    }

    await fulfillJson(route, success(currentUser));
  });

  await page.route('**/api/v1/auth/login', async (route) => {
    currentUser = {
      id: 'user-b',
      email: 'beta@prima.test',
      full_name: 'Beta User',
    };
    currentToken = 'token-beta';
    currentSyllabi = [buildSyllabus('syllabus-b', 'Beta Syllabus')];

    await fulfillJson(
      route,
      success({
        access_token: currentToken,
        token_type: 'bearer',
        user: currentUser,
      })
    );
  });

  await page.route('**/api/v1/design-sessions/', async (route) => {
    await fulfillJson(route, success({ sessions: [], total: 0 }));
  });

  await page.route('**/api/v1/syllabi/', async (route) => {
    await fulfillJson(route, success({ syllabi: currentSyllabi, total: currentSyllabi.length }));
  });
}

test('redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Masuk untuk lanjut bekerja')).toBeVisible();
  await expect(page.getByText('Daftar sekarang')).toBeVisible();
});

test('restores session, shows reduced nav, and clears session on logout', async ({ page }) => {
  await installStatefulAuthMocks(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('prima.auth.accessToken', 'token-alpha');
  });

  await page.goto('/');

  await expect(page).toHaveURL('/');
  await expect(page.getByText('Dashboard', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Kurikulum', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Personalisasi', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('History')).toHaveCount(0);
  await expect(page.getByText('Roadmap')).toHaveCount(0);
  await expect(page.getByText('Alpha Syllabus')).toBeVisible();

  await page.getByText('Keluar').click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Masuk untuk lanjut bekerja')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('prima.auth.accessToken')))
    .toBeNull();
});

test('login after logout shows new user data instead of stale cached dashboard data', async ({ page }) => {
  await installStatefulAuthMocks(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('prima.auth.accessToken', 'token-alpha');
  });

  await page.goto('/');
  await expect(page.getByText('Alpha Syllabus')).toBeVisible();

  await page.getByText('Keluar').click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByPlaceholder('nama@perusahaan.com').fill('beta@prima.test');
  await page.getByPlaceholder('Masukkan password').fill('password-aman');
  await page.getByText('Masuk', { exact: true }).last().click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText('Beta Syllabus')).toBeVisible();
  await expect(page.getByText('Alpha Syllabus')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('prima.auth.accessToken')))
    .toBe('token-beta');
});
