/**
 * EditableList Usage Examples
 *
 * This file demonstrates how to use EditableList with different data structures.
 * These examples show the component's flexibility for various use cases.
 *
 * NOTE: This is a documentation/example file, not used in production code.
 */

import { useState } from 'react';
import { EditableList } from './EditableList';
import { EditableText } from '@/features/tenant-admin/visual-editor/components/EditableText';
import { Star } from 'lucide-react';
import type { TestimonialItem, FaqItem } from '@macon/contracts';

/**
 * Example 1: Testimonials List
 * Structure: { quote, author, role?, imageUrl?, rating }
 */
export function TestimonialsListExample() {
  const [items, setItems] = useState<TestimonialItem[]>([]);

  return (
    <EditableList
      items={items}
      onUpdate={setItems}
      maxItems={10}
      emptyMessage="No testimonials yet. Add your first testimonial to get started."
      createNewItem={() => ({
        quote: 'Enter testimonial quote...',
        author: 'Customer Name',
        role: 'Verified Client',
        rating: 5,
      })}
      renderItem={(item, index, onChange) => (
        <div className="space-y-3">
          {/* Star Rating */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onChange({ ...item, rating: star })}
                className="cursor-pointer hover:scale-110 transition-transform"
              >
                <Star
                  className={`h-5 w-5 ${star <= item.rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-300'}`}
                />
              </button>
            ))}
          </div>

          {/* Quote */}
          <EditableText
            value={item.quote}
            onChange={(value) => onChange({ ...item, quote: value })}
            placeholder="Testimonial quote"
            multiline
            rows={3}
            className="text-neutral-600 italic"
            aria-label={`Testimonial ${index + 1} quote`}
          />

          {/* Author */}
          <div className="border-t pt-3">
            <EditableText
              value={item.author}
              onChange={(value) => onChange({ ...item, author: value })}
              placeholder="Author name"
              className="font-semibold text-neutral-900"
              aria-label={`Testimonial ${index + 1} author`}
            />
            <EditableText
              value={item.role ?? ''}
              onChange={(value) => onChange({ ...item, role: value || undefined })}
              placeholder="Role (optional)"
              className="text-sm text-neutral-500"
              aria-label={`Testimonial ${index + 1} role`}
            />
          </div>
        </div>
      )}
    />
  );
}

/**
 * Example 2: FAQ List
 * Structure: { question, answer }
 */
export function FaqListExample() {
  const [items, setItems] = useState<FaqItem[]>([]);

  return (
    <EditableList
      items={items}
      onUpdate={setItems}
      maxItems={20}
      emptyMessage="No FAQ items yet. Add your first question."
      createNewItem={() => ({
        question: 'Enter your question',
        answer: 'Enter your answer here...',
      })}
      renderItem={(item, index, onChange) => (
        <div className="space-y-3">
          <EditableText
            value={item.question}
            onChange={(value) => onChange({ ...item, question: value })}
            placeholder="Enter question"
            className="font-medium text-neutral-900"
            aria-label={`FAQ question ${index + 1}`}
          />
          <EditableText
            value={item.answer}
            onChange={(value) => onChange({ ...item, answer: value })}
            placeholder="Enter answer"
            multiline
            rows={3}
            className="text-neutral-600"
            aria-label={`FAQ answer ${index + 1}`}
          />
        </div>
      )}
    />
  );
}

/**
 * Example 3: Simple String Array
 * Structure: string[]
 */
export function HighlightsListExample() {
  const [items, setItems] = useState<string[]>([]);

  return (
    <EditableList
      items={items}
      onUpdate={setItems}
      maxItems={8}
      emptyMessage="No highlights yet. Add key features or amenities."
      createNewItem={() => 'New highlight'}
      renderItem={(item, index, onChange) => (
        <EditableText
          value={item}
          onChange={(value) => onChange(value)}
          placeholder="Enter highlight"
          className="text-neutral-700"
          aria-label={`Highlight ${index + 1}`}
        />
      )}
    />
  );
}

/**
 * Example 4: Social Proof Items
 * Structure: { icon: string, text: string }
 */
interface SocialProofItem {
  icon: string;
  text: string;
}

export function SocialProofListExample() {
  const [items, setItems] = useState<SocialProofItem[]>([]);

  return (
    <EditableList
      items={items}
      onUpdate={setItems}
      maxItems={5}
      emptyMessage="No social proof items yet."
      createNewItem={() => ({
        icon: 'star',
        text: 'Social proof text',
      })}
      renderItem={(item, index, onChange) => (
        <div className="flex gap-3 items-start">
          <select
            value={item.icon}
            onChange={(e) => onChange({ ...item, icon: e.target.value })}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="star">Star</option>
            <option value="users">Users</option>
            <option value="calendar">Calendar</option>
            <option value="award">Award</option>
          </select>
          <EditableText
            value={item.text}
            onChange={(value) => onChange({ ...item, text: value })}
            placeholder="Social proof text"
            className="flex-1"
            aria-label={`Social proof ${index + 1}`}
          />
        </div>
      )}
    />
  );
}
