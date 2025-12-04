/**
 * CatalogFilters Component - Sprint 9
 * Search, filter, and sort controls for package catalog
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X, ChevronDown } from 'lucide-react';

interface CatalogFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  priceRange: { min: number; max: number };
  onPriceRangeChange: (range: { min: number; max: number }) => void;
  sortBy: 'price-asc' | 'price-desc';
  onSortChange: (sort: 'price-asc' | 'price-desc') => void;
}

export function CatalogFilters({
  searchQuery,
  onSearchChange,
  priceRange,
  onPriceRangeChange,
  sortBy,
  onSortChange,
}: CatalogFiltersProps) {
  // Local search state for debouncing
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  // Check if any filters are active
  const hasActiveFilters = searchQuery || priceRange.min > 0 || priceRange.max < Infinity;

  // Clear all filters
  const clearFilters = () => {
    setLocalSearch('');
    onSearchChange('');
    onPriceRangeChange({ min: 0, max: Infinity });
  };

  return (
    <div className="bg-white rounded-xl border-2 border-neutral-200 p-6 shadow-elevation-1">
      {/* Main Filters Row */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 w-5 h-5"
              aria-hidden="true"
            />
            <Input
              type="text"
              placeholder="Search packages by name or description..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-12 min-h-[44px] text-lg border-neutral-300 focus:border-macon-orange focus:ring-macon-orange/20"
              aria-label="Search packages"
            />
          </div>
        </div>

        {/* Sort Dropdown */}
        <div className="w-full lg:w-64">
          <Select
            value={sortBy}
            onValueChange={(value) => onSortChange(value as 'price-asc' | 'price-desc')}
          >
            <SelectTrigger className="min-h-[44px] text-lg border-neutral-300 focus:border-macon-orange focus:ring-macon-orange/20">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price-asc" className="text-lg">
                Price: Low to High
              </SelectItem>
              <SelectItem value="price-desc" className="text-lg">
                Price: High to Low
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={clearFilters}
            className="w-full lg:w-auto min-h-[44px] border-2 hover:bg-danger-50 hover:border-danger-300 hover:text-danger-700 transition-colors"
            aria-label="Clear all filters"
          >
            <X className="w-5 h-5 mr-2" aria-hidden="true" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Advanced Filters Toggle */}
      <div className="mt-6 pt-6 border-t border-neutral-200">
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="flex items-center gap-2 text-lg text-macon-navy-700 hover:text-macon-orange font-medium transition-colors min-h-[44px]"
          aria-expanded={showAdvancedFilters}
          aria-controls="advanced-filters"
        >
          <ChevronDown
            className={`w-5 h-5 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
          Advanced Filters
        </button>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div id="advanced-filters" className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Price Range Filter */}
            <div>
              <label className="block text-base font-medium text-neutral-700 mb-3">
                Price Range
              </label>
              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Min ($)"
                    value={priceRange.min || ''}
                    onChange={(e) =>
                      onPriceRangeChange({
                        ...priceRange,
                        min: Number(e.target.value) || 0,
                      })
                    }
                    className="min-h-[44px] text-lg border-neutral-300 focus:border-macon-orange focus:ring-macon-orange/20"
                    aria-label="Minimum price"
                    min="0"
                  />
                </div>
                <span className="text-neutral-400 font-medium">to</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Max ($)"
                    value={priceRange.max === Infinity ? '' : priceRange.max}
                    onChange={(e) =>
                      onPriceRangeChange({
                        ...priceRange,
                        max: Number(e.target.value) || Infinity,
                      })
                    }
                    className="min-h-[44px] text-lg border-neutral-300 focus:border-macon-orange focus:ring-macon-orange/20"
                    aria-label="Maximum price"
                    min="0"
                  />
                </div>
              </div>
              <p className="text-sm text-neutral-500 mt-2">
                Filter packages by price range (leave max empty for no limit)
              </p>
            </div>

            {/* Placeholder for future filters */}
            <div className="text-neutral-400 text-base flex items-center justify-center border-2 border-dashed border-neutral-200 rounded-lg p-6">
              More filters coming soon
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
