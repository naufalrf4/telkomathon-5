import { View, Text } from 'react-native';
import { usePathname } from 'expo-router';

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Mulai, lanjutkan, atau buka hasil kerja terbaru Anda.' },
  '/syllabus': { title: 'Kurikulum', subtitle: 'Lihat kurikulum final dan lanjutkan langkah berikutnya.' },
  '/syllabus/generated': { title: 'Kurikulum', subtitle: 'Lihat kurikulum final dan lanjutkan langkah berikutnya.' },
  '/syllabus/create': { title: 'Buat kurikulum', subtitle: 'Unggah materi lalu susun kurikulum tahap demi tahap.' },
  '/personalize': { title: 'Personalisasi', subtitle: 'Pilih kurikulum final lalu buat rekomendasi belajar.' },
  '/design-session/new': { title: 'Buat kurikulum', subtitle: 'Unggah materi lalu susun kurikulum tahap demi tahap.' },
};

function getPageMeta(pathname: string): { title: string; subtitle: string } {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  if (pathname.startsWith('/syllabus/create/')) return { title: 'Susun kurikulum', subtitle: 'Ikuti langkah yang sedang aktif hingga kurikulum siap dipakai.' };
  if (pathname.match(/^\/syllabus\/[^/]+\/revision$/)) return { title: 'Tinjau dan revisi', subtitle: 'Perbarui kurikulum final sebelum digunakan untuk personalisasi.' };
  if (pathname.match(/^\/personalize\/[^/]+\/bulk$/)) return { title: 'Personalisasi multi-user', subtitle: 'Siapkan rekomendasi untuk banyak peserta sekaligus.' };
  if (pathname.startsWith('/design-session/')) return { title: 'Susun kurikulum', subtitle: 'Ikuti langkah yang sedang aktif hingga kurikulum siap dipakai.' };
  if (pathname.startsWith('/syllabus/')) return { title: 'Detail kurikulum', subtitle: 'Tinjau hasil akhir dan lanjutkan ke personalisasi.' };
  if (pathname.startsWith('/personalize/')) return { title: 'Personalisasi', subtitle: 'Masukkan kebutuhan peserta lalu buat rekomendasi belajar.' };
  return { title: 'PRIMA', subtitle: 'Kelola alur kerja belajar Anda.' };
}

export function Header() {
  const pathname = usePathname();
  const meta = getPageMeta(pathname);
  return (
    <View className="border-b border-neutral-300 bg-surface px-6 py-4">
      <Text className="text-lg font-semibold text-neutral-950">{meta.title}</Text>
      <Text className="mt-1 text-sm text-neutral-600">{meta.subtitle}</Text>
    </View>
  );
}
