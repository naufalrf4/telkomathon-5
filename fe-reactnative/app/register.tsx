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
import { register } from '../src/services/auth';
import { useAuthStore } from '../src/stores/authStore';

export default function RegisterPage() {
  const router = useRouter();
  const { accessToken, hydrated, setSession } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && accessToken) {
      router.replace('/');
    }
  }, [accessToken, hydrated, router]);

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: (session) => {
      appQueryClient.clear();
      setSession({ accessToken: session.access_token, user: session.user });
      router.replace('/');
    },
    onError: (mutationError) => setError(getErrorMessage(mutationError, 'Registrasi gagal.')),
  });

  const canSubmit = useMemo(() => fullName.trim() && email.trim() && password.trim().length >= 8, [fullName, email, password]);

  return (
    <AuthLayout
      title="Buat akun baru"
      description="Mulai menyusun kurikulum dan membuat rencana belajar yang lebih tepat untuk setiap peserta."
      formTitle="Daftar"
      formDescription="Setelah akun dibuat, Anda bisa langsung masuk ke alur kerja utama."
    >
      <View className="gap-4">
        <TextField label="Nama lengkap" value={fullName} onChangeText={setFullName} placeholder="Nama Anda" />
        <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="nama@perusahaan.com" />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Minimal 8 karakter" />
      </View>

      {error ? (
        <View className="mt-4">
          <AlertBanner variant="error" title="Pendaftaran belum berhasil" description={error} />
        </View>
      ) : null}

      <View className="mt-6 gap-3">
        <Button title="Daftar" onPress={() => registerMutation.mutate({ full_name: fullName.trim(), email: email.trim(), password })} disabled={!canSubmit} isLoading={registerMutation.isPending} fullWidth />
        <View className="mt-2 flex-row justify-center">
          <Text className="text-neutral-600">Sudah punya akun? </Text>
          <Text onPress={() => router.push('/login')} className="text-primary-600 font-medium">Masuk</Text>
        </View>
      </View>
    </AuthLayout>
  );
}
