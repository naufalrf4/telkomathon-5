import { View, Image } from 'react-native';

export function MobileTopBar() {
  return (
    <View className="bg-white border-b border-gray-200 px-6 py-3 items-center">
      <Image
        source={require('../../../assets/aispace-logo.png')}
        style={{ width: 124, height: 37 }}
        resizeMode="contain"
      />
    </View>
  );
}
