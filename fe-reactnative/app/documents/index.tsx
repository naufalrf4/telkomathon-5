import { View, Text, FlatList, Alert, Platform } from 'react-native';

export default function DocumentsScreen() {
  const { documents, isLoading, uploadDocument, isUploading, deleteDocument } = useDocuments();

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const formData = new FormData();
      
      if (Platform.OS === 'web' && file.file) {
        formData.append('file', file.file);
      } else {
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        } as any);
      }

      uploadDocument(formData, {
        onError: (error) => Alert.alert('Upload Failed', error.message),
      });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen message="Loading documents..." />;

  return (
    <View className="flex-1">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-2xl font-bold text-gray-900">Documents</Text>
        <Button 
          title="Upload" 
          onPress={handleUpload} 
          isLoading={isUploading}
          icon={<Ionicons name="cloud-upload-outline" size={18} color="white" />}
        />
      </View>

      {!documents || documents.length === 0 ? (
        <EmptyState 
          title="No documents yet" 
          description="Upload your learning materials (PDF, DOCX, PPTX) to get started."
          action={{ label: "Upload Document", onPress: handleUpload }}
        />
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card className="mb-4">
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center flex-1">
                  <View className="bg-red-50 p-3 rounded-lg mr-4">
                    <Ionicons 
                      name={item.file_type.includes('pdf') ? 'document-text' : 'document'} 
                      size={24} 
                      color={colors.primary} 
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900 text-base" numberOfLines={1}>{item.filename}</Text>
                    <View className="flex-row items-center mt-1 space-x-2">
                      <Badge label={item.file_type.split('/')[1]?.toUpperCase() || 'FILE'} size="sm" variant="secondary" />
                      <Text className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                </View>
                <Button 
                  title="" 
                  variant="outline" 
                  size="sm"
                  className="border-0 p-2"
                  icon={<Ionicons name="trash-outline" size={20} color={colors.error} />}
                  onPress={() => Alert.alert('Delete', 'Are you sure?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteDocument(item.id) }
                  ])}
                />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
