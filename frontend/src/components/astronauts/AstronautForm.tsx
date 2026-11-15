'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { astronautService } from '../../services/astronautService';
import { missionService } from '@/services/missionService';
import { storageService } from '@/services/storageService';
import { Astronaut } from '../../domain/astronauts/types';
import { Mission } from '@/domain/missions/types';
import { AstronautFallbackAvatar } from './AstronautFallbackAvatar';
import { FaceBiometricsManager } from './FaceBiometricsManager';
import {
  UploadCloud,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

interface AstronautFormProps {
  initialData?: Astronaut | null;
}

export function AstronautForm({ initialData }: AstronautFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [name, setName] = useState(initialData?.name || '');
  const [role, setRole] = useState(initialData?.role || '');
  const [age, setAge] = useState<number | string>(initialData?.age || 40);
  const [missionId, setMissionId] = useState(initialData?.missionId || '');
  const [availableMissions, setAvailableMissions] = useState<Mission[]>([]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.photoUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lista de misiones: se carga una vez; si no hay misión elegida se toma la primera.
  useEffect(() => {
    missionService
      .list({ limit: 50 })
      .then((res) => {
        setAvailableMissions(res.data);
        setMissionId((current) => current || res.data[0]?.id || '');
      })
      .catch((err: unknown) =>
        setErrorMessage(err instanceof Error ? err.message : 'Unable to load the mission list.'),
      );
  }, []);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl((previous) => {
      if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsedAge = parseInt(String(age), 10);
    if (!name.trim() || !role.trim() || !missionId || isNaN(parsedAge) || parsedAge <= 0) {
      setErrorMessage(
        'Please complete all required fields marked with (*). Age must be a positive number.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      let finalPhotoUrl = previewUrl;

      if (selectedFile) {
        setIsUploading(true);
        finalPhotoUrl = await storageService.uploadImage(selectedFile, 'astronauts');
        setIsUploading(false);
      }

      if (isEditing && initialData) {
        await astronautService.update(initialData.id, {
          name: name.trim(),
          role: role.trim(),
          age: parsedAge,
          missionId,
          photoUrl: finalPhotoUrl,
        });
      } else {
        await astronautService.create({
          name: name.trim(),
          role: role.trim(),
          age: parsedAge,
          missionId,
          photoUrl: finalPhotoUrl,
        });
      }

      router.push('/astronauts');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save crew member to database.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="surface-card mx-auto max-w-2xl p-6 sm:p-10 animate-materialize">
      <div>
        <Link
          href="/astronauts"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-berry hover:text-blueberry transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Crew Directory</span>
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
          {isEditing ? 'Edit Astronaut Profile' : 'Register New Astronaut'}
        </h1>
        <p className="mt-1.5 text-sm text-stem">
          Enter the crew member&apos;s details, mission assignment, and profile photograph.
        </p>
      </div>

      {errorMessage && (
        <div role="alert" className="mt-8 ui-callout-critical flex items-start gap-3 text-xs text-status-critical">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        <div>
          <label
            htmlFor="astro-name"
            className="block text-xs font-semibold text-blueberry"
          >
            Astronaut Full Name *
          </label>
          <input
            id="astro-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Christina Koch"
            className="ui-input mt-1.5 text-sm placeholder:text-stem/60"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="astro-role"
              className="block text-xs font-semibold text-blueberry"
            >
              Mission Role *
            </label>
            <input
              id="astro-role"
              type="text"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Mission Specialist (Science)"
              className="ui-input mt-1.5 text-sm placeholder:text-stem/60"
            />
          </div>

          <div>
            <label
              htmlFor="astro-age"
              className="block text-xs font-semibold text-blueberry"
            >
              Age (Years) *
            </label>
            <input
              id="astro-age"
              type="number"
              min="20"
              max="75"
              required
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="ui-input mt-1.5 font-mono text-sm tabular-nums"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="astro-mission"
            className="block text-xs font-semibold text-blueberry"
          >
            Assigned Mission *
          </label>
          <div className="mt-1.5">
            <select
              id="astro-mission"
              required
              value={missionId}
              onChange={(e) => setMissionId(e.target.value)}
              className="ui-select text-sm"
            >
              {availableMissions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.environment})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2">
          <span className="block text-xs font-semibold text-blueberry mb-3">
            Profile Photograph (optional)
          </span>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              {previewUrl ? (
                <div className="relative h-24 w-24 overflow-hidden">
                  <Image
                    src={previewUrl}
                    alt="Photo preview"
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="tactile-press absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-sm bg-blueberry text-plate hover:bg-status-critical"
                    title="Remove photo"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <AstronautFallbackAvatar
                    name={name || 'New Astronaut'}
                    className="h-24 w-24"
                  />
                  <span className="text-[11px] text-stem mt-1.5">Preview</span>
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <label
                htmlFor="photo-file"
                className="tactile-press inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-berry hover:text-blueberry"
              >
                <UploadCloud className="h-4 w-4" />
                <span>{selectedFile ? 'Change photograph' : 'Upload photograph'}</span>
                <input
                  id="photo-file"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>

              <p className="mt-2 text-xs text-stem">
                Supported formats: JPG, PNG, or WEBP (max. 5 MB).
              </p>

              {selectedFile && (
                <span className="mt-1 inline-block font-mono text-[11px] tabular-nums text-status-nominal">
                  File ready: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>
          </div>
        </div>

        {isEditing && initialData && (
          <div className="pt-2">
            <FaceBiometricsManager
              astronautId={initialData.id}
              astronautName={name || initialData.name}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-4 pt-4">
          <Link
            href="/astronauts"
            className="tactile-press py-2 text-xs font-semibold text-stem hover:text-blueberry"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="tactile-press flex items-center gap-2 rounded-sm bg-blueberry px-6 py-2.5 text-xs font-semibold text-plate hover:bg-berry disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-plate border-t-transparent" />
                <span>Uploading image...</span>
              </>
            ) : isSubmitting ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-plate border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>{isEditing ? 'Save changes' : 'Register crew member'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
