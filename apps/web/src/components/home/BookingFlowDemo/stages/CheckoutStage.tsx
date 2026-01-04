'use client';

import { ChevronLeft, Lock, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StageProps } from '../types';

/**
 * CheckoutStage - Payment form view
 *
 * Shows the checkout form with order summary and secure payment input.
 * Stripe-style form fields with trust indicators.
 */
export function CheckoutStage({ active }: StageProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 p-3 transition-all duration-500 overflow-hidden',
        active ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center">
            <ChevronLeft className="w-3 h-3 text-text-muted" />
          </button>
          <p className="text-[11px] font-semibold text-text-primary">Checkout</p>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-text-muted">
          <Lock className="w-2.5 h-2.5 text-sage" />
          <span>Secure</span>
        </div>
      </div>

      {/* Order summary card */}
      <div className="bg-neutral-800/50 rounded-xl p-2.5 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] font-medium text-text-primary">Essential Package</p>
            <p className="text-[9px] text-text-muted">Thu, Jan 9 at 2:00 PM</p>
          </div>
          <p className="text-sm font-bold text-text-primary">$275</p>
        </div>
        <div className="border-t border-neutral-700 pt-2 flex items-center justify-between">
          <span className="text-[9px] text-text-muted">Total</span>
          <span className="text-[11px] font-bold text-sage">$275.00</span>
        </div>
      </div>

      {/* Contact info */}
      <div className="mb-3">
        <p className="text-[9px] font-medium text-text-muted mb-1.5">Contact</p>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-neutral-800 rounded-lg px-2 py-1.5">
            <p className="text-[8px] text-neutral-500 mb-0.5">Name</p>
            <p className="text-[10px] text-text-primary">Sarah Johnson</p>
          </div>
          <div className="bg-neutral-800 rounded-lg px-2 py-1.5">
            <p className="text-[8px] text-neutral-500 mb-0.5">Email</p>
            <p className="text-[10px] text-text-primary truncate">sarah@email.com</p>
          </div>
        </div>
      </div>

      {/* Payment form */}
      <div className="mb-3">
        <p className="text-[9px] font-medium text-text-muted mb-1.5">Payment</p>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-3.5 h-3.5 text-text-muted" />
            <div className="flex-1 flex items-center gap-1.5">
              <span className="text-[10px] text-text-primary">•••• •••• •••• 4242</span>
              <div className="flex gap-1">
                <div className="w-6 h-4 bg-[#1A1F71] rounded flex items-center justify-center">
                  <span className="text-[6px] text-white font-bold italic">VISA</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-neutral-700/50 rounded px-2 py-1">
              <p className="text-[8px] text-neutral-500">Expires</p>
              <p className="text-[9px] text-text-primary">12/28</p>
            </div>
            <div className="bg-neutral-700/50 rounded px-2 py-1">
              <p className="text-[8px] text-neutral-500">CVC</p>
              <p className="text-[9px] text-text-primary">•••</p>
            </div>
          </div>
        </div>
      </div>

      {/* Submit button */}
      <button className="w-full bg-sage hover:bg-sage-hover text-white py-2.5 rounded-full text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-sage/20">
        <Lock className="w-3 h-3" />
        Pay $275.00
      </button>

      {/* Trust badge */}
      <p className="text-[8px] text-text-muted text-center mt-2">
        Powered by Stripe • Cancel up to 24hrs before
      </p>
    </div>
  );
}
