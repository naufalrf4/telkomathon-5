import { View, Text } from 'react-native';
import { usePathname } from 'expo-router';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/documents': 'Documents',
  '/syllabus': 'Syllabus',
  '/syllabus/generated': 'Generated Syllabus',
  '/syllabus/create': 'Create Syllabus',
  '/design-session': 'Resume Create Flow',
  '/syllabus/generate': 'Create Syllabus',
  '/design-session/new': 'Create Syllabus',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/documents/')) return 'Detail Dokumen';
  if (pathname.startsWith('/syllabus/create/')) return 'Create Syllabus';
  if (pathname.startsWith('/design-session/')) return 'Resume Create Flow';
  if (pathname.match(/^\/syllabus\/[^/]+\/revision$/)) return 'Revision Workspace';
  if (pathname.match(/^\/syllabus\/[^/]+\/export$/)) return 'Export DOCX';
  if (pathname.startsWith('/syllabus/')) return 'Silabus';
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
