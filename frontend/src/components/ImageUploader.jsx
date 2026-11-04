import React, { useRef, useState } from 'react';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import { validateImageFile } from '../utils/validators';
import { MAX_IMAGE_SIZE_MB } from '../utils/constants';

const ImageUploader = ({
  label = 'Upload Image',
  file,
  preview,
  onFileChange,
  error,
  required = false,
  disabled = false,
  helperText,
}) => {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState('');

  const openPicker = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleSelectedFile = (selected) => {
    if (!selected) {
      return;
    }

    const result = validateImageFile(selected);
    if (result && result.valid === false) {
      setLocalError(result.message || 'That file could not be used.');
      return;
    }

    setLocalError('');
    onFileChange?.(selected);
  };

  const handleInputChange = (event) => {
    const selected = event.target.files?.[0] || null;
    handleSelectedFile(selected);
    // Reset so selecting the same file again still triggers a change.
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    if (disabled) {
      return;
    }
    const selected = event.dataTransfer?.files?.[0] || null;
    handleSelectedFile(selected);
  };

  const handleRemove = () => {
    setLocalError('');
    onFileChange?.(null);
  };

  const displayError = error || localError;
  const hasFile = Boolean(preview || file);

  return (
    <div>
      {label ? (
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required ? <span className="ml-1 text-rose-500">*</span> : null}
        </label>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />

      {hasFile ? (
        <div className="relative overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700">
          <img
            src={preview}
            alt="Selected preview"
            className="h-48 w-full object-cover"
          />
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <span className="truncate text-xs text-slate-500 dark:text-slate-400">
              {file?.name || 'Selected image'}
            </span>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
            >
              <DeleteIcon fontSize="inherit" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) {
              setDragActive(true);
            }
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={handleDrop}
          disabled={disabled}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
            dragActive
              ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
              : 'border-slate-300 bg-white hover:border-teal-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700/50'
          }`}
        >
          <CloudUploadIcon className="text-slate-400 dark:text-slate-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Drag & drop an image here, or click to browse
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            JPEG, PNG or WEBP up to {MAX_IMAGE_SIZE_MB}MB
          </span>
        </button>
      )}

      {displayError ? (
        <p className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">{displayError}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
};

export default ImageUploader;
