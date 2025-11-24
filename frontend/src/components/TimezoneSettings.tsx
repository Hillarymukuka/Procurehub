import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { COMMON_TIMEZONES } from "../utils/timezone";

export default function TimezoneSettings() {
  const { user, updateProfile } = useAuth();
  const [selectedTimezone, setSelectedTimezone] = useState(user?.timezone || "Africa/Cairo");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      await updateProfile({ timezone: selectedTimezone });
      setMessage("Timezone updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("Failed to update timezone");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Timezone Settings</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Timezone
        </label>
        <select
          value={selectedTimezone}
          onChange={(e) => setSelectedTimezone(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#107DAC]"
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-gray-500">
          All dates and times will be displayed in your selected timezone.
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving || selectedTimezone === user?.timezone}
        className="bg-[#107DAC] text-white px-4 py-2 rounded-md hover:bg-opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isSaving ? "Saving..." : "Save Timezone"}
      </button>

      {message && (
        <p className={`mt-3 text-sm ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
