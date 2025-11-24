import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/client';

interface CompanySettings {
  id: number;
  company_name: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
}

export default function CompanySettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await apiClient.get('/api/admin/company-settings');
      setSettings(response.data);
      if (response.data.logo_url) {
        setLogoPreview(response.data.logo_url);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No settings exist yet, initialize with defaults
        setSettings({
          id: 0,
          company_name: '',
        });
      } else {
        setMessage({ type: 'error', text: 'Failed to load company settings' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CompanySettings, value: string) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Please select an image file' });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setMessage(null);

    try {
      // Save/update company settings
      if (settings.id === 0) {
        // Create new
        await apiClient.post('/api/admin/company-settings', settings);
      } else {
        // Update existing
        await apiClient.put('/api/admin/company-settings', settings);
      }

      // Upload logo if selected
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        await apiClient.post('/api/admin/company-settings/logo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setMessage({ type: 'success', text: 'Company settings saved successfully!' });
      fetchSettings(); // Refresh
      setLogoFile(null);
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Failed to save settings' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('Are you sure you want to delete the company logo?')) return;

    try {
      await apiClient.delete('/api/admin/company-settings/logo');
      setLogoPreview(null);
      setLogoFile(null);
      setMessage({ type: 'success', text: 'Logo deleted successfully' });
      fetchSettings();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete logo' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header with Back Button */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Go back"
        >
          <svg
            className="w-6 h-6 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <h1 className="text-3xl font-bold text-gray-800">Company Settings</h1>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Company Logo */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Company Logo
          </label>
          <div className="flex items-center space-x-4">
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Company Logo"
                className="h-24 w-auto object-contain border border-gray-300 rounded p-2"
              />
            )}
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-white
                  hover:file:bg-primary-dark
                  cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Recommended: PNG or JPG, 300x150px
              </p>
            </div>
            {logoPreview && (
              <button
                type="button"
                onClick={handleDeleteLogo}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete Logo
              </button>
            )}
          </div>
        </div>

        <hr />

        {/* Company Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Company Name *
          </label>
          <input
            type="text"
            value={settings.company_name}
            onChange={(e) => handleInputChange('company_name', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            required
          />
        </div>

        {/* Address */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Address Line 1
            </label>
            <input
              type="text"
              value={settings.address_line1 || ''}
              onChange={(e) => handleInputChange('address_line1', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Address Line 2
            </label>
            <input
              type="text"
              value={settings.address_line2 || ''}
              onChange={(e) => handleInputChange('address_line2', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
            <input
              type="text"
              value={settings.city || ''}
              onChange={(e) => handleInputChange('city', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">State/Province</label>
            <input
              type="text"
              value={settings.state || ''}
              onChange={(e) => handleInputChange('state', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Postal Code</label>
            <input
              type="text"
              value={settings.postal_code || ''}
              onChange={(e) => handleInputChange('postal_code', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
            <input
              type="text"
              value={settings.country || ''}
              onChange={(e) => handleInputChange('country', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
            <input
              type="tel"
              value={settings.phone || ''}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={settings.email || ''}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Website</label>
            <input
              type="url"
              value={settings.website || ''}
              onChange={(e) => handleInputChange('website', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving || !settings.company_name}
            className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Usage Note:</h3>
        <p className="text-sm text-blue-800">
          These settings will be used in all generated documents, including Purchase Orders sent to suppliers.
          Make sure to keep this information up to date.
        </p>
      </div>
    </div>
  );
}
