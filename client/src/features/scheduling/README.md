# Scheduling Feature Components

Customer-facing scheduling components for the MAIS platform.

## Components

### TimeSlotPicker

Displays available time slots for a selected service on a specific date, allowing customers to pick a time.

**Location:** `/Users/mikeyoung/CODING/MAIS/client/src/features/scheduling/TimeSlotPicker.tsx`

**API Endpoint:** `GET /v1/public/availability/slots?serviceId=xxx&date=YYYY-MM-DD`

#### Props

```typescript
interface TimeSlotPickerProps {
  serviceId: string; // Service ID to fetch slots for
  selectedDate: Date; // Date to show slots for
  onSelect: (slot: { startTime: Date; endTime: Date }) => void; // Callback when slot is selected
  selectedSlot?: { startTime: Date; endTime: Date }; // Currently selected slot (optional)
}
```

#### Features

- React Query integration with automatic refetch when serviceId or date changes
- Loading states with spinner
- Empty state for no available slots
- Visual highlighting of selected slot
- 12-hour time formatting (e.g., "9:00 AM")
- Responsive grid layout (2-4 columns based on screen size)
- Disabled state for unavailable slots
- Visual legend showing slot states

#### Usage

```typescript
import { TimeSlotPicker } from "@/features/scheduling";

function BookingPage() {
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: Date;
    endTime: Date;
  }>();

  return (
    <TimeSlotPicker
      serviceId="service_123"
      selectedDate={new Date()}
      onSelect={setSelectedSlot}
      selectedSlot={selectedSlot}
    />
  );
}
```

#### Styling

- Uses Tailwind CSS classes
- Grid of time slot buttons (2-4 columns responsive)
- Available slots: white background, border
- Selected slot: macon-orange background, white text
- Unavailable slots: gray background, disabled cursor
- Hover effects on available slots

#### API Response Format

```typescript
{
  date: "2025-11-27",
  serviceId: "service_123",
  timezone: "America/New_York",
  slots: [
    {
      startTime: "2025-11-27T09:00:00Z",  // ISO datetime (UTC)
      endTime: "2025-11-27T10:00:00Z",    // ISO datetime (UTC)
      available: true
    },
    // ... more slots
  ]
}
```

## Example

See `TimeSlotPicker.example.tsx` for a complete booking flow example.

## Integration Notes

1. **Tenant Context:** The component uses the API client which automatically includes the `X-Tenant-Key` header for multi-tenant support.

2. **React Query:** The component uses React Query with a 5-minute stale time. The query automatically refetches when `serviceId` or `selectedDate` changes.

3. **Time Formatting:** Times are displayed in the user's local timezone using `toLocaleTimeString()` with 12-hour format.

4. **Error Handling:** Shows a user-friendly error message if the API call fails.

5. **Accessibility:** All slot buttons are properly labeled and keyboard accessible.

## Testing

To test this component:

1. Start the API server: `npm run dev:api`
2. Start the client: `npm run dev:client`
3. Ensure you have a service with availability rules configured
4. Navigate to a page using the TimeSlotPicker component
5. Select a date and verify slots appear correctly
