import { View, Text } from 'react-native';
import { usePathname } from 'expo-router';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Home',
  '/documents': 'Documents',
  '/syllabus': 'Syllabus',
  '/syllabus/generate': 'Buat Silabus',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/documents/')) return 'Detail Dokumen';
  if (pathname.startsWith('/syllabus/')) return 'Syllabus';
  if (pathname.startsWith('/personalize/')) return 'Personalisasi';
  if (pathname.startsWith('/chat/')) return 'Chat & Revisi';
  if (pathname.startsWith('/export/')) return 'Ekspor';
  return 'MyDigiLearn';
}

export function Header() {
  const pathname = usePathname();
  return (
    <View className="bg-white border-b border-gray-200 px-6 py-3">
      <Text className="text-lg font-semibold text-gray-900">{getPageTitle(pathname)}</Text>
    </View>
  );
}
