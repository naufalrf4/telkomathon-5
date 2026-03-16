# AGENTS.md — Frontend (React Native / Expo Web)

## Platform Target

- **Primary**: Desktop Web (Expo Web) — designed desktop-first, responsive down to tablet/mobile
- **Secondary**: iOS / Android via Expo (same codebase)
- **Dev**: `npx expo start --web` for web development

## Stack

- **Framework**: React Native with Expo SDK 52+ (targeting Web primarily)
- **Router**: Expo Router v4 (file-based routing, supports web)
- **Language**: TypeScript (strict mode)
- **Styling**: NativeWind v4 (TailwindCSS for React Native — responsive utilities built-in)
- **State Management**: Zustand (global state) + @tanstack/react-query v5 (server state)
- **HTTP Client**: Axios with typed interceptors + TanStack Query for caching
- **UI Components**: Custom component library (Telkom Red theme) + react-native-paper where useful
- **Icons**: @expo/vector-icons (MaterialIcons, Ionicons)
- **File Picker**: expo-document-picker (cross-platform file upload)
- **Testing**: Jest + React Native Testing Library
- **Linting**: ESLint + Prettier

## Branding: MyDigiLearn × AI Space Telkom Indonesia

### Color Palette (Telkom Red Theme)

```typescript
// src/theme/colors.ts
export const colors = {
  // Primary — Telkom Red
  primary: '#E4002B',          // Telkom Red (main CTA, headers)
  primaryDark: '#B8001F',      // Pressed/active state
  primaryLight: '#FF3D5A',     // Lighter accent

  // Secondary
  secondary: '#1A1A2E',        // Dark navy (text, backgrounds)
  secondaryLight: '#2D2D44',   // Card backgrounds (dark mode)

  // Neutral
  white: '#FFFFFF',
  background: '#F5F5F8',       // Light gray page background
  surface: '#FFFFFF',          // Card/surface white
  border: '#E0E0E6',          // Subtle borders
  disabled: '#B0B0B8',        // Disabled state

  // Text
  textPrimary: '#1A1A2E',     // Main text
  textSecondary: '#6B6B80',   // Secondary/muted text
  textOnPrimary: '#FFFFFF',   // Text on red backgrounds
  textLink: '#E4002B',        // Links (Telkom Red)

  // Semantic
  success: '#00A651',          // Success green
  warning: '#FFB800',          // Warning amber
  error: '#D32F2F',            // Error red (distinct from primary)
  info: '#2196F3',             // Info blue

  // AI-specific
  aiAccent: '#7C3AED',        // Purple for AI-generated content indicators
  aiBackground: '#F3F0FF',    // Light purple background for AI outputs
};
```

### Typography

```typescript
// src/theme/typography.ts
export const typography = {
  fontFamily: {
    regular: 'Inter_400Regular',      // Or System default
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};
```

### Branding Elements

- **App Name**: "MyDigiLearn" (shown in header/splash)
- **Subtitle**: "Powered by AI Space Telkom Indonesia"
- **Logo**: Telkom Indonesia logo mark (red T) + "MyDigiLearn" wordmark
- **Header style**: White background, Telkom Red accent bar at top
- **Primary buttons**: Telkom Red background, white text, rounded (8px radius)
- **Cards**: White surface, subtle shadow, 12px border radius
- **AI output sections**: Light purple background (#F3F0FF) with purple left border to indicate AI-generated content

## Project Structure

```
fe-reactnative/
├── app/                        # Expo Router — file-based routing
│   ├── _layout.tsx             # Root layout (nav container, theme provider)
│   ├── index.tsx               # Home/Dashboard screen
│   ├── upload.tsx              # Document upload screen
│   ├── generate.tsx            # Syllabus generation screen
│   ├── syllabus/
│   │   ├── [id].tsx            # Syllabus detail view
│   │   └── index.tsx           # Syllabi list
│   ├── personalize.tsx         # Gap input + micro-learning
│   ├── chat/
│   │   └── [syllabusId].tsx    # Chat/revise for specific syllabus
│   └── export/
│       └── [syllabusId].tsx    # PDF preview + download
│
├── src/
│   ├── features/               # Feature-based modules
│   │   ├── documents/
│   │   │   ├── UploadScreen.tsx
│   │   │   ├── DocumentList.tsx
│   │   │   ├── DocumentCard.tsx
│   │   │   └── useDocuments.ts
│   │   ├── syllabus/
│   │   │   ├── GenerateForm.tsx
│   │   │   ├── SyllabusView.tsx
│   │   │   ├── TLOCard.tsx
│   │   │   ├── ELOList.tsx
│   │   │   ├── JourneyTimeline.tsx
│   │   │   └── useSyllabus.ts
│   │   ├── personalize/
│   │   │   ├── GapInputForm.tsx
│   │   │   ├── ModuleRecommendations.tsx
│   │   │   ├── CompetencySelector.tsx
│   │   │   └── usePersonalize.ts
│   │   ├── chat/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── RevisionDiff.tsx
│   │   │   └── useChat.ts
│   │   └── export/
│   │       ├── PDFPreview.tsx
│   │       └── useExport.ts
│   │
│   ├── components/             # Shared UI components
│   │   ├── Button.tsx          # Telkom Red primary button
│   │   ├── Card.tsx            # White card with shadow
│   │   ├── Header.tsx          # App header with branding
│   │   ├── LoadingOverlay.tsx  # AI generation loading state
│   │   ├── AIOutputCard.tsx    # Purple-accented AI output display
│   │   ├── FilePickerButton.tsx
│   │   ├── LevelSelector.tsx   # L1-L5 level picker
│   │   ├── StatusBadge.tsx
│   │   └── EmptyState.tsx
│   │
│   ├── hooks/                  # Shared hooks
│   │   ├── useApi.ts           # Generic API hook with loading/error
│   │   └── useAuth.ts          # Auth state (if needed)
│   │
│   ├── services/               # API client layer
│   │   ├── api.ts              # Axios/fetch instance with base URL
│   │   ├── documentService.ts  # /api/v1/documents endpoints
│   │   ├── syllabusService.ts  # /api/v1/syllabi endpoints
│   │   ├── personalizeService.ts
│   │   ├── chatService.ts
│   │   └── exportService.ts
│   │
│   ├── theme/                  # Branding & design tokens
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   └── index.ts
│   │
│   └── types/                  # TypeScript type definitions
│       ├── document.ts
│       ├── syllabus.ts
│       ├── personalize.ts
│       ├── chat.ts
│       └── api.ts              # Generic API response types
│
│   ├── stores/                  # Zustand state stores
│   │   ├── useAppStore.ts       # Global UI state (sidebar, theme)
│   │   └── useUploadStore.ts    # Upload progress state
│   │
│   └── providers/               # React context providers
│       └── QueryProvider.tsx     # TanStack Query client setup
│
├── assets/                     # Images, fonts, icons
│   ├── telkom-logo.png
│   ├── mydigilearn-logo.png
│   └── splash.png
├── global.css                  # Tailwind directives (@tailwind base/components/utilities)
├── tailwind.config.ts          # NativeWind/Tailwind config (Telkom colors, fonts)
├── nativewind-env.d.ts         # NativeWind TypeScript ambient types
├── metro.config.js             # Metro bundler config (NativeWind CSS)
├── app.json                    # Expo config
├── package.json
├── tsconfig.json
└── babel.config.js
```

## Coding Conventions

### Component Structure (NativeWind)
```tsx
// PascalCase.tsx — every component file uses NativeWind className (NO StyleSheet.create)
import { View, Text, Pressable } from 'react-native';

interface SyllabusCardProps {
  title: string;
  level: number;
  onPress: () => void;
}

export function SyllabusCard({ title, level, onPress }: SyllabusCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100
                 active:scale-[0.98] transition-transform"
    >
      <Text className="font-semibold text-base text-secondary">
        {title}
      </Text>
      <Text className="font-normal text-sm text-gray-500 mt-1">
        Level {level}
      </Text>
    </Pressable>
  );
}
```

**Rules**:
- **ALWAYS** use NativeWind `className` — NEVER use `StyleSheet.create`
- Use Tailwind utility classes from `tailwind.config.ts` (extended with Telkom theme)
- Use `Pressable` instead of `TouchableOpacity` (better web support)
- Export as named function (not `React.FC`) — simpler, better type inference
- Responsive classes: `sm:`, `md:`, `lg:`, `xl:` for breakpoint-based styles

### Hook Pattern (TanStack Query)
```typescript
// useXxx.ts — ALL data fetching uses TanStack Query (NO manual useState/useEffect)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { syllabusService } from '@/services/syllabusService';
import type { Syllabus, SyllabusCreate } from '@/types/syllabus';

// READ — useQuery for GET requests
export function useSyllabus(id: string) {
  return useQuery<Syllabus>({
    queryKey: ['syllabus', id],
    queryFn: () => syllabusService.getById(id),
    enabled: !!id,
  });
}

export function useSyllabusList() {
  return useQuery<Syllabus[]>({
    queryKey: ['syllabi'],
    queryFn: () => syllabusService.list(),
  });
}

// WRITE — useMutation for POST/PUT/DELETE
export function useGenerateSyllabus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SyllabusCreate) => syllabusService.generate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syllabi'] });
    },
  });
}
```

**Rules**:
- **ALWAYS** use TanStack Query for server state — NEVER manual `useState`+`useEffect` for API calls
- `useQuery` for GET requests, `useMutation` for POST/PUT/DELETE
- Query keys must be descriptive arrays: `['syllabi']`, `['syllabus', id]`, `['documents']`
- Invalidate related queries on mutation success
- Use `enabled` option to conditionally fetch

### Zustand Store Pattern (Client State)
```typescript
// src/stores/useAppStore.ts — global client state (NOT server data)
import { create } from 'zustand';

interface AppState {
  // Upload flow
  selectedDocIds: string[];
  addDocId: (id: string) => void;
  removeDocId: (id: string) => void;
  clearDocIds: () => void;

  // Generation flow
  generationTopic: string;
  generationLevel: number;
  setGenerationTopic: (topic: string) => void;
  setGenerationLevel: (level: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedDocIds: [],
  addDocId: (id) => set((s) => ({ selectedDocIds: [...s.selectedDocIds, id] })),
  removeDocId: (id) => set((s) => ({ selectedDocIds: s.selectedDocIds.filter((d) => d !== id) })),
  clearDocIds: () => set({ selectedDocIds: [] }),

  generationTopic: '',
  generationLevel: 3,
  setGenerationTopic: (topic) => set({ generationTopic: topic }),
  setGenerationLevel: (level) => set({ generationLevel: level }),
}));
```

**Rules**:
- **Zustand** for UI/client state only (selections, form state, navigation state)
- **TanStack Query** for ALL server data (API responses, cache, loading/error)
- NEVER duplicate server data in Zustand — single source of truth
- One store per concern if needed (e.g., `useAppStore`, `useUIStore`)

### Service Pattern
```typescript
// xxxService.ts — API client per feature
import { api } from './api';
import { SyllabusCreate, SyllabusResponse } from '@/types/syllabus';

export const syllabusService = {
  generate: (data: SyllabusCreate): Promise<SyllabusResponse> =>
    api.post('/api/v1/syllabi/generate', data).then(r => r.data.data),

  getById: (id: string): Promise<SyllabusResponse> =>
    api.get(`/api/v1/syllabi/${id}`).then(r => r.data.data),

  list: (): Promise<SyllabusResponse[]> =>
    api.get('/api/v1/syllabi').then(r => r.data.data),
};
```

### Type Definitions
```typescript
// types/syllabus.ts
export interface ELO {
  id: string;
  description: string;
  pce: string;  // Performance, Condition, Evaluation
}

export interface LearningJourney {
  preLearning: JourneyPhase;
  classroom: JourneyPhase;
  afterLearning: JourneyPhase;
}

export interface Syllabus {
  id: string;
  topic: string;
  targetLevel: number;
  tlo: string;
  elos: ELO[];
  journey: LearningJourney;
  createdAt: string;
}

export interface SyllabusCreate {
  topic: string;
  targetLevel: number;
  docIds: string[];
}
```

## UI/UX Guidelines

### Responsive Layout (Desktop-First)

**Breakpoints** (NativeWind/Tailwind — desktop-first, scale down):
```
xl: 1280px+  → Full desktop layout (sidebar + main + detail panel)
lg: 1024px+  → Desktop layout (sidebar + main)
md: 768px+   → Tablet layout (collapsible sidebar + main)
sm: 640px+   → Large mobile (single column)
default      → Mobile (single column, bottom nav)
```

**Desktop Sidebar Layout** (primary layout for web):
```tsx
// app/_layout.tsx — root layout with responsive sidebar
import { View } from 'react-native';
import { Slot } from 'expo-router';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

export default function RootLayout() {
  return (
    <View className="flex-1 flex-row bg-background">
      {/* Sidebar — hidden on mobile, visible on md+ */}
      <View className="hidden md:flex w-64 lg:w-72 border-r border-border bg-white">
        <Sidebar />
      </View>

      {/* Main content area */}
      <View className="flex-1">
        <Header />
        <View className="flex-1 px-4 md:px-8 lg:px-12 py-6 max-w-5xl mx-auto w-full">
          <Slot />
        </View>
      </View>
    </View>
  );
}
```

**Responsive Rules**:
- Content max-width: `max-w-5xl` (1024px) centered on large screens
- Sidebar: `hidden md:flex` — collapses to bottom nav or hamburger on mobile
- Grid layouts: `flex-col md:flex-row` for card grids
- Font sizes scale: `text-sm md:text-base lg:text-lg`
- Padding scales: `p-4 md:p-6 lg:p-8`
- Cards in grid: `w-full md:w-1/2 lg:w-1/3` for responsive columns

### Tailwind Config (NativeWind Theme Extension)
```javascript
// tailwind.config.ts
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#E4002B', dark: '#B8001F', light: '#FF3D5A' },
        secondary: { DEFAULT: '#1A1A2E', light: '#2D2D44' },
        background: '#F5F5F8',
        surface: '#FFFFFF',
        border: '#E0E0E6',
        ai: { accent: '#7C3AED', bg: '#F3F0FF' },
      },
      fontFamily: {
        sans: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold: ['Inter_700Bold'],
      },
    },
  },
  plugins: [],
};
```

### Loading States for AI Generation
- Syllabus generation can take 15-30 seconds
- Show animated loading overlay with progress text: "Menganalisis dokumen...", "Membuat TLO...", "Menyusun ELO..."
- Use SSE (Server-Sent Events) for real-time progress updates if possible

### AI Output Display
- AI-generated content wrapped in `AIOutputCard` with light purple background
- Small "AI Generated" badge in top-right corner
- Clear visual distinction between user input and AI output

### Navigation Flow
```
Home (Dashboard)
├── Upload Documents → Document List
├── Generate Syllabus → Select Topic → Select Level → [Loading] → Syllabus View
│   ├── Chat/Revise → Revised Syllabus View
│   └── Export PDF → PDF Preview → Download
└── Personalize → Gap Input → [Loading] → Module Recommendations
```

### Screen Design Principles
- **Desktop-first**: Design for 1280px+ screens, scale down responsively
- Max content width `max-w-5xl` centered on large screens
- Sidebar navigation on desktop, bottom tabs on mobile
- Bottom sheet for actions on mobile (modals on desktop)
- Pull-to-refresh on list screens (mobile only)
- Skeleton loading screens (not spinners)
- Toast notifications for success/error feedback

## Testing Rules

- Every screen has at least one snapshot test
- Custom hooks tested with `renderHook`
- Service layer tested with mocked API responses
- No `any` types — use proper generics or unknown

## Platform Target

- **Primary**: Desktop Web via Expo Web (`npx expo start --web`) — designed desktop-first
- **Secondary**: Tablet / Mobile responsive (same codebase)
- **Tertiary**: iOS + Android via Expo (if time permits)
- **Dev**: `npx expo start --web` for development
- **Build**: EAS Build for native, `npx expo export:web` for web deployment
