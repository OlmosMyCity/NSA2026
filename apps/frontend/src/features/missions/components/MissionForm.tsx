'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { missionService } from '../services/missionService';
import { storageService } from '@/features/common/services/storageService';
import { Mission, Environment, MissionStatus } from '../domain/types';
import { MissionFallbackPatch } from './MissionFallbackPatch';
import {
  TRAJECTORY_PRESETS,
  VEHICLE_OPTIONS,
  getMissionSimConfig,
  saveMissionSimConfig,
  validateTrajectoryJson,
} from '@/features/visualizer/domain/missionSimulationConfig';
import {
  UploadCloud,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Orbit,
} from 'lucide-react';

interface MissionFormProps {
  initialData?: Mission | null;
  isEditing?: boolean;
}

export function MissionForm({ initialData, isEditing = false }: MissionFormProps) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [environment, setEnvironment] = useState<Environment>(
    initialData?.environment || 'LUNAR_BASE',
  );
  const [status, setStatus] = useState<MissionStatus>(initialData?.status || 'IN_PROGRESS');
  const [startDate, setStartDate] = useState(
    initialData?.startDate
      ? new Date(initialData.startDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
  );
  const [endDate, setEndDate] = useState(
    initialData?.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : '',
  );

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.patchUrl || null);
  const [vehicleId, setVehicleId] = useState<string>('auto');
  const [trajectoryPreset, setTrajectoryPreset] = useState<string>('auto');
  const [customTrajectoryJson, setCustomTrajectoryJson] = useState<string | null>(null);
  const [customTrajectoryName, setCustomTrajectoryName] = useState<string | null>(null);
  const [trajectoryError, setTrajectoryError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description);
      setEnvironment(initialData.environment);
      setStatus(initialData.status);
      setStartDate(new Date(initialData.startDate).toISOString().split('T')[0]);
      if (initialData.endDate) {
        setEndDate(new Date(initialData.endDate).toISOString().split('T')[0]);
      }
      setPreviewUrl(initialData.patchUrl || null);
      const savedSim = getMissionSimConfig(initialData.id);
      if (savedSim) {
        setVehicleId(savedSim.vehicleId || 'auto');
        setTrajectoryPreset(savedSim.trajectoryPreset || 'auto');
        setCustomTrajectoryJson(savedSim.customTrajectoryJson ?? null);
        setCustomTrajectoryName(savedSim.customFileName ?? null);
      }
    }
  }, [initialData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleTrajectoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTrajectoryError(null);
    try {
      const text = await file.text();
      validateTrajectoryJson(text);
      setCustomTrajectoryJson(text);
      setCustomTrajectoryName(file.name);
    } catch (err) {
      setTrajectoryError(err instanceof Error ? err.message : 'Invalid trajectory JSON file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !description.trim() || !startDate) {
      setErrorMessage('Please complete all required fields marked with (*).');
      return;
    }

    try {
      setIsSubmitting(true);
      let finalPatchUrl = previewUrl;

      if (selectedFile) {
        setIsUploading(true);
        finalPatchUrl = await storageService.uploadImage(selectedFile, 'missions');
        setIsUploading(false);
      }

      let savedMission: Mission;
      if (isEditing && initialData) {
        savedMission = await missionService.update(initialData.id, {
          name: name.trim(),
          description: description.trim(),
          environment,
          status,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : null,
          patchUrl: finalPatchUrl,
        });
      } else {
        savedMission = await missionService.create({
          name: name.trim(),
          description: description.trim(),
          environment,
          status,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : null,
          patchUrl: finalPatchUrl,
        });
      }

      saveMissionSimConfig(savedMission.id, {
        vehicleId,
        trajectoryPreset,
        customTrajectoryJson,
        customFileName: customTrajectoryName,
      });

      router.push('/missions');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save mission in mission control.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="surface-card mx-auto max-w-2xl p-6 sm:p-10">
      <div>
        <Link
          href="/missions"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stem hover:text-blueberry transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Missions Registry</span>
        </Link>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
          {isEditing ? 'Edit Mission' : 'New Mission'}
        </h1>
        <p className="mt-1 text-sm text-stem">
          Define the operational environment, mission dates, and official mission patch.
        </p>
      </div>

      {errorMessage && (
        <div role="alert" className="mt-8 ui-callout-critical flex items-start gap-2.5 text-xs text-status-critical">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        <div>
          <label htmlFor="mission-name" className="block text-xs font-semibold text-blueberry">
            Official Mission Name *
          </label>
          <input
            id="mission-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Artemis IV — Lunar South Pole Expedition"
            className="ui-input mt-1.5 text-sm placeholder-stem/60"
          />
        </div>

        <div>
          <label htmlFor="mission-desc" className="block text-xs font-semibold text-blueberry">
            Operational Description &amp; Objectives *
          </label>
          <textarea
            id="mission-desc"
            rows={3}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details of exploration objectives, habitat modules, and crew stay schedule..."
            className="ui-input mt-1.5 text-sm placeholder-stem/60 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="mission-env" className="block text-xs font-semibold text-blueberry">
              Operational Environment *
            </label>
            <select
              id="mission-env"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as Environment)}
              className="ui-select mt-1.5 text-sm"
            >
              <option value="LUNAR_BASE">Lunar Base (0.166g)</option>
              <option value="STATION">Orbital Station (Gateway 0g)</option>
              <option value="ROVER">Pressurized Lunar Rover</option>
              <option value="SPACECRAFT">Spacecraft (Orion)</option>
              <option value="MARS_BASE">Mars Base (0.38g)</option>
            </select>
          </div>

          <div>
            <label htmlFor="mission-status" className="block text-xs font-semibold text-blueberry">
              Mission Status *
            </label>
            <select
              id="mission-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as MissionStatus)}
              className="ui-select mt-1.5 text-sm"
            >
              <option value="IN_PROGRESS">In Progress (active)</option>
              <option value="PLANNING">Planning</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="mission-start" className="block text-xs font-semibold text-blueberry">
              Launch / Start Date *
            </label>
            <input
              id="mission-start"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="ui-input mt-1.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="mission-end" className="block text-xs font-semibold text-blueberry">
              Estimated End Date (optional)
            </label>
            <input
              id="mission-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="ui-input mt-1.5 text-sm"
            />
          </div>
        </div>

        <div className="rounded-lg border border-line bg-surface-tinted/40 p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blueberry">
            <Orbit className="h-4 w-4 text-berry" aria-hidden="true" />
            <span>3D Simulation, Vehicle &amp; Trajectory</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="mission-vehicle" className="block text-xs font-semibold text-blueberry">
                Launch / Spacecraft Vehicle
              </label>
              <select
                id="mission-vehicle"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="ui-input mt-1.5 text-sm"
              >
                {VEHICLE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} ({v.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="mission-trajectory" className="block text-xs font-semibold text-blueberry">
                Orbital Trajectory Preset
              </label>
              <select
                id="mission-trajectory"
                value={trajectoryPreset}
                onChange={(e) => setTrajectoryPreset(e.target.value)}
                disabled={Boolean(customTrajectoryJson)}
                className="ui-input mt-1.5 text-sm disabled:opacity-50"
              >
                {TRAJECTORY_PRESETS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label
              htmlFor="mission-trajectory-file"
              className="tactile-press inline-flex cursor-pointer items-center gap-2 rounded-pill border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-blueberry hover:bg-surface-tinted"
            >
              <UploadCloud className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
              <span>
                {customTrajectoryName
                  ? `Custom JSON: ${customTrajectoryName}`
                  : 'Upload Custom Trajectory (.json)'}
              </span>
              <input
                id="mission-trajectory-file"
                type="file"
                accept=".json,application/json"
                onChange={handleTrajectoryUpload}
                className="sr-only"
              />
            </label>

            {customTrajectoryJson && (
              <button
                type="button"
                onClick={() => {
                  setCustomTrajectoryJson(null);
                  setCustomTrajectoryName(null);
                  setTrajectoryError(null);
                }}
                className="text-xs font-semibold text-status-critical hover:underline"
              >
                Remove custom JSON
              </button>
            )}
          </div>

          {trajectoryError && (
            <p role="alert" className="text-xs text-status-critical">
              {trajectoryError}
            </p>
          )}
        </div>

        <div className="pt-2">
          <span className="block text-xs font-semibold text-blueberry mb-3">
            Mission Patch (optional)
          </span>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              {previewUrl ? (
                <div className="relative h-24 w-24 overflow-hidden">
                  <Image
                    src={previewUrl}
                    alt="Patch preview"
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="tactile-press absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-sm bg-status-critical text-plate"
                    title="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <MissionFallbackPatch name={name || 'New Mission'} className="h-24 w-24" />
                  <span className="text-[11px] text-stem mt-1">Preview</span>
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <label
                htmlFor="patch-file"
                className="tactile-press inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-berry hover:text-blueberry"
              >
                <UploadCloud className="h-4 w-4" />
                <span>{selectedFile ? 'Change image' : 'Upload patch'}</span>
                <input
                  id="patch-file"
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
                <span className="mt-1 inline-block font-mono text-xs text-status-nominal">
                  File ready: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Link
            href="/missions"
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
                <span>{isEditing ? 'Save changes' : 'Create mission'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
