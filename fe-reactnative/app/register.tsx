import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
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
      setSession({ accessToken: session.access_token, user: session.user });
      router.replace('/');
    },
    onError: (mutationError) => setError(getErrorMessage(mutationError, 'Registrasi gagal.')),
  });

  const canSubmit = useMemo(() => fullName.trim() && email.trim() && password.trim().length >= 8, [fullName, email, password]);

  return (
    <View className="flex-1 items-center justify-center py-10">
      <View className="w-full max-w-md gap-6">
        <View className="items-center gap-3">
          <View className="rounded-2xl bg-white px-5 py-4 shadow-sm border border-gray-100">
            <Image source={require('../assets/aispace-logo.png')} style={{ width: 148, height: 44 }} resizeMode="contain" />
          </View>
          <View className="items-center gap-1">
            <Text className="text-3xl font-bold text-gray-900">Buat akun PRIMA</Text>
            <Text className="text-center text-sm text-gray-500">Registrasi akun baru untuk mengelola syllabus, revisi, roadmap, dan riwayat kerja.</Text>
          </View>
        </View>

        <Card className="w-full p-8 shadow-xl shadow-gray-200/60 border border-gray-100">
          <View className="mb-6 gap-2">
            <Text className="text-3xl font-bold text-gray-900">Registrasi akun</Text>
            <Text className="text-sm text-gray-500">Akun baru akan langsung bisa dipakai untuk flow syllabus yang terproteksi.</Text>
          </View>

        <View className="gap-4">
          <View className="gap-2">
            <Text className="text-sm font-semibold text-gray-700">Nama lengkap</Text>
            <TextInput value={fullName} onChangeText={setFullName} placeholder="Nama Anda" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900" />
          </View>
          <View className="gap-2">
            <Text className="text-sm font-semibold text-gray-700">Email</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="nama@perusahaan.com" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900" />
          </View>
          <View className="gap-2">
            <Text className="text-sm font-semibold text-gray-700">Password</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Minimal 8 karakter" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900" />
          </View>
        </View>

        {error ? (
          <View className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

          <View className="mt-6 gap-3">
            <Button title="Daftar" onPress={() => registerMutation.mutate({ full_name: fullName.trim(), email: email.trim(), password })} disabled={!canSubmit} isLoading={registerMutation.isPending} fullWidth className="py-3" />
            <Button title="Sudah punya akun" variant="outline" onPress={() => router.push('/login')} fullWidth className="py-3" />
          </View>
        </Card>
      </View>
    </View>
  );
}
