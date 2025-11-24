# Quick Start: Adding Timezone Settings to Your Application

## For Users to Change Their Timezone

### Option 1: Add to User Profile/Settings Page

If you have a user profile or settings page, add the TimezoneSettings component:

```typescript
import TimezoneSettings from '../components/TimezoneSettings';

function UserProfilePage() {
  return (
    <Layout>
      <div className="space-y-6">
        <h1>User Settings</h1>
        
        {/* Other profile settings */}
        <div>
          <h2>Personal Information</h2>
          {/* Name, email, etc. */}
        </div>
        
        {/* Timezone Settings */}
        <TimezoneSettings />
        
        {/* Other settings */}
      </div>
    </Layout>
  );
}
```

### Option 2: Add to Header/Navigation Menu

Add a quick timezone selector to the header:

```typescript
import { useAuth } from '../context/AuthContext';
import { COMMON_TIMEZONES } from '../utils/timezone';

function Header() {
  const { user, updateProfile } = useAuth();
  
  const handleTimezoneChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await updateProfile({ timezone: e.target.value });
  };
  
  return (
    <header>
      {/* Other header content */}
      
      <select 
        value={user?.timezone || 'Africa/Cairo'}
        onChange={handleTimezoneChange}
        className="text-sm border rounded px-2 py-1"
      >
        {COMMON_TIMEZONES.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label}
          </option>
        ))}
      </select>
    </header>
  );
}
```

## Converting Existing Date Displays

### Before (incorrect - uses browser timezone):
```typescript
<span>{new Date(rfq.deadline).toLocaleDateString()}</span>
<span>{new Date(message.created_at).toLocaleString()}</span>
```

### After (correct - uses user's configured timezone):
```typescript
import { useTimezone } from '../hooks/useTimezone';

function MyComponent() {
  const { formatDisplay } = useTimezone();
  
  return (
    <>
      <span>{formatDisplay(rfq.deadline)}</span>
      <span>{formatDisplay(message.created_at, { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
      })}</span>
    </>
  );
}
```

## Creating Forms with Datetime Inputs

### Pattern for New Forms:
```typescript
import { useTimezone } from '../hooks/useTimezone';

function CreateRFQForm() {
  const { toUtc, getCurrentLocal } = useTimezone();
  const [deadline, setDeadline] = useState('');
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Convert user's local time to UTC before sending to API
    await apiClient.post('/api/rfqs/', {
      deadline: toUtc(deadline),
      // ... other fields
    });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <label>Deadline</label>
      <input
        type="datetime-local"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
        min={getCurrentLocal(60000)}  // 1 minute from now
        required
      />
      <button type="submit">Create</button>
    </form>
  );
}
```

## Editing Existing Data

When editing an RFQ with an existing deadline:

```typescript
import { useTimezone } from '../hooks/useTimezone';

function EditRFQForm({ rfq }: { rfq: RFQ }) {
  const { toUtc, formatForInput } = useTimezone();
  
  // Convert UTC deadline to user's timezone for display in input
  const [deadline, setDeadline] = useState(formatForInput(rfq.deadline));
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Convert back to UTC for API
    await apiClient.put(`/api/rfqs/${rfq.id}`, {
      deadline: toUtc(deadline),
    });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="datetime-local"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
      />
      <button type="submit">Update</button>
    </form>
  );
}
```

## Best Practices Summary

### ✅ Always Do:
1. **Store in UTC**: All datetimes in database are UTC
2. **Convert on input**: Use `toUtc()` when sending to API
3. **Convert on display**: Use `formatDisplay()` when showing to users
4. **Use hook**: Import `useTimezone()` in every component that handles dates

### ❌ Never Do:
1. **Don't use browser timezone**: Avoid `new Date().toLocaleString()`
2. **Don't hardcode timezones**: Always use user's configured timezone
3. **Don't send local time**: Always convert to UTC before API calls
4. **Don't display UTC**: Always convert to user's timezone for display

## Testing Your Changes

1. **Change your user's timezone**:
   - Use TimezoneSettings component
   - Select different timezone (e.g., "America/New_York")

2. **Create an RFQ**:
   - Set deadline: Jan 15, 2025 16:00
   - Check database: Should show UTC time
   - View in UI: Should show 4:00 PM in your timezone

3. **Switch timezone again**:
   - Change to "Asia/Tokyo"
   - View same RFQ
   - Deadline should now show in Tokyo time

## Need Help?

See `TIMEZONE_IMPLEMENTATION.md` for complete documentation including:
- Architecture details
- All available functions
- Common pitfalls
- Troubleshooting guide
