import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Blackout = {
  date: string;
  reason?: string;
};

interface BlackoutsTabProps {
  blackouts: Blackout[];
  isLoading: boolean;
  onAddBlackout: (date: string, reason: string) => Promise<void>;
}

/**
 * BlackoutsTab Component
 *
 * Manages blackout dates in the admin dashboard
 */
export function BlackoutsTab({ blackouts, isLoading, onAddBlackout }: BlackoutsTabProps) {
  const [newBlackoutDate, setNewBlackoutDate] = useState('');
  const [newBlackoutReason, setNewBlackoutReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlackoutDate) return;

    await onAddBlackout(newBlackoutDate, newBlackoutReason);
    setNewBlackoutDate('');
    setNewBlackoutReason('');
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-macon-navy-800 border-white/20">
        <h2 className="text-2xl font-semibold mb-4 text-white">Add Blackout Date</h2>
        <form onSubmit={handleSubmit} className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="blackoutDate" className="text-white/90 text-lg">
              Date
            </Label>
            <Input
              id="blackoutDate"
              type="date"
              value={newBlackoutDate}
              onChange={(e) => setNewBlackoutDate(e.target.value)}
              className="bg-macon-navy-900 border-white/20 text-white focus:border-white/30 text-lg h-12"
              required
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="blackoutReason" className="text-white/90 text-lg">
              Reason (optional)
            </Label>
            <Input
              id="blackoutReason"
              type="text"
              value={newBlackoutReason}
              onChange={(e) => setNewBlackoutReason(e.target.value)}
              placeholder="Holiday, maintenance, etc."
              className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              className="bg-macon-navy hover:bg-macon-navy-dark text-lg h-12 px-6"
            >
              Add
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6 bg-macon-navy-800 border-white/20">
        <h2 className="text-2xl font-semibold mb-6 text-white">Blackout Dates</h2>
        <Table>
          <TableHeader>
            <TableRow className="border-white/20 hover:bg-macon-navy-700">
              <TableHead className="text-white/90 text-lg">Date</TableHead>
              <TableHead className="text-white/90 text-lg">Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="hover:bg-macon-navy-700">
                <TableCell colSpan={2} className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/60" />
                </TableCell>
              </TableRow>
            ) : blackouts.length === 0 ? (
              <TableRow className="hover:bg-macon-navy-700">
                <TableCell colSpan={2} className="text-center py-8 text-white/90 text-lg">
                  No blackout dates
                </TableCell>
              </TableRow>
            ) : (
              blackouts.map((blackout) => (
                <TableRow key={blackout.date} className="border-white/20 hover:bg-macon-navy-700">
                  <TableCell className="font-medium">
                    <Badge
                      variant="outline"
                      className="border-white/30 bg-macon-navy-700 text-white/70 text-base"
                    >
                      {blackout.date}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white/90 text-base">{blackout.reason || ''}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
