import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { colors, shadows, spacing, borderRadius } from '../lib/theme';

interface ImageUploadProps {
  jobCardId: string;
  technicianId?: string; // Optional: for folder isolation
  images: { id: string; public_url: string; storage_path: string; caption: string | null }[];
  onImagesUpdated: () => void;
}

export default function ImageUpload({ jobCardId, images, onImagesUpdated }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to upload photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    // Request permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permissions to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    let filename: string | null = null;

    try {
      // Validate user before upload to prevent orphaned files
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error('User not authenticated. Please log in again.');
      }

      // Convert URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Detect MIME type from blob
      const contentType = blob.type || 'image/jpeg';

      // Generate unique filename with folder structure: job-cards/<job_card_id>/<timestamp>.<ext>
      // This allows managers to view all, technicians to access their own
      const ext = contentType.split('/')[1] || 'jpg';
      filename = `job-cards/${jobCardId}/${Date.now()}.${ext}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-card-images')
        .upload(filename, blob, {
          contentType: contentType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('job-card-images')
        .getPublicUrl(filename);

      // Save to database
      const { error: dbError } = await supabase
        .from('job_card_images')
        .insert({
          job_card_id: jobCardId,
          storage_path: filename,
          public_url: publicUrl,
          uploaded_by: userData.user.id,
        });

      if (dbError) {
        // Cleanup: delete uploaded file if database insert fails
        if (filename) {
          try {
            await supabase.storage.from('job-card-images').remove([filename]);
          } catch (cleanupError) {
            console.warn('[ImageUpload] Cleanup failed:', cleanupError);
          }
        }
        throw dbError;
      }

      onImagesUpdated();
      Alert.alert('Success', 'Photo uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (imageId: string, storagePath: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from storage
              const { error: storageError } = await supabase.storage
                .from('job-card-images')
                .remove([storagePath]);

              if (storageError) {
                console.error('Storage delete error:', storageError);
                Alert.alert('Error', 'Failed to delete photo from storage');
                return;
              }

              // Delete from database
              const { error: dbError } = await supabase
                .from('job_card_images')
                .delete()
                .eq('id', imageId);

              if (dbError) throw dbError;

              onImagesUpdated();
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete photo');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Site Photos</Text>

      {/* Image Gallery */}
      <ScrollView horizontal style={styles.imagesGrid} showsHorizontalScrollIndicator={false}>
        {images.map((image) => (
          <View key={image.id} style={styles.imageContainer}>
            <Image source={{ uri: image.public_url }} style={styles.image} />
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deleteImage(image.id, image.storage_path ?? '')}
            >
              <Text style={styles.deleteButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        
        {/* Upload Buttons */}
        <TouchableOpacity style={styles.uploadButton} onPress={takePhoto} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <Text style={styles.uploadButtonText}>📷 Take Photo</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <Text style={styles.uploadButtonText}>📁 Gallery</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Text style={styles.hint}>{images.length} photo(s) uploaded</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
    color: colors.foreground,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  uploadButtonText: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  imageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  deleteButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: spacing.xs,
  },
  deleteButtonText: {
    color: colors.destructiveForeground,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
});
