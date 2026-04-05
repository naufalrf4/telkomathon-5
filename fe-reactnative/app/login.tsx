import { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { AlertBanner } from '../src/components/ui/AlertBanner';
import { TextField } from '../src/components/ui/TextField';
import { AuthLayout } from '../src/components/auth/AuthLayout';
import { appQueryClient } from '../src/queryClient';
import { getErrorMessage } from '../src/services/api';
import { getMe, login } from '../src/services/auth';
import { useAuthStore } from '../src/stores/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { accessToken, hydrated, setSession } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && accessToken) {
      router.replace('/');
    }
  }, [accessToken, hydrated, router]);

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async (session) => {
      appQueryClient.clear();
      setSession({ accessToken: session.access_token, user: session.user });
      try {
        const me = await getMe();
        setSession({ accessToken: session.access_token, user: me });
      } catch {
        // keep initial session payload if /me is temporarily unavailable
      }
      router.replace('/');
    },
    onError: (mutationError) => setError(getErrorMessage(mutationError, 'Login gagal.')),
  });

  const canSubmit = useMemo(() => email.trim() && password.trim(), [email, password]);

  return (
    <AuthLayout
      title="Masuk untuk lanjut bekerja"
      description="Buka kembali kurikulum aktif dan lanjutkan penyesuaian belajar tanpa kehilangan progres."
      formTitle="Masuk"
      formDescription="Gunakan akun Anda untuk membuka ruang kerja yang terakhir dipakai."
    >
      <View className="gap-4">
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="nama@perusahaan.com"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Masukkan password"
        />
      </View>

      {error ? (
        <View className="mt-4">
          <AlertBanner variant="error" title="Masuk belum berhasil" description={error} />
        </View>
      ) : null}

      <View className="mt-6 gap-3">
        <Button title="Masuk" onPress={() => loginMutation.mutate({ email: email.trim(), password })} disabled={!canSubmit} isLoading={loginMutation.isPending} fullWidth />
        <View className="mt-2 flex-row justify-center">
          <Text className="text-neutral-600">Belum punya akun? </Text>
          <Text onPress={() => router.push('/register')} className="text-primary-600 font-medium">Daftar sekarang</Text>
        </View>
      </View>
    </AuthLayout>
  );
}
