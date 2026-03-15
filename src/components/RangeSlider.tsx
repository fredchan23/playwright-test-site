import { useState, useEffect, useRef } from 'react';

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  values: [number, number];
  onChange: (values: [number, number]) => void;
  label?: string;
  formatValue?: (value: number) => string;
}

export default function RangeSlider({
  min,
  max,
  step = 1,
  values,
  onChange,
  label,
  formatValue = (v) => v.toString(),
}: RangeSliderProps) {
  const [localValues, setLocalValues] = useState<[number, number]>(values);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValues(values);
  }, [values]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = Number(e.target.value);
    const newValues: [number, number] = [Math.min(newMin, localValues[1]), localValues[1]];
    setLocalValues(newValues);
    onChange(newValues);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = Number(e.target.value);
    const newValues: [number, number] = [localValues[0], Math.max(newMax, localValues[0])];
    setLocalValues(newValues);
    onChange(newValues);
  };

  const minPercent = ((localValues[0] - min) / (max - min)) * 100;
  const maxPercent = ((localValues[1] - min) / (max - min)) * 100;

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-slate-700">{label}</h4>
          <div className="text-sm text-slate-600">
            {formatValue(localValues[0])} - {formatValue(localValues[1])}
          </div>
        </div>
      )}

      <div className="relative pt-2 pb-4" ref={sliderRef}>
        <div className="relative h-2 bg-slate-200 rounded-full">
          <div
            className="absolute h-2 bg-slate-900 rounded-full"
            style={{
              left: `${minPercent}%`,
              right: `${100 - maxPercent}%`,
            }}
          />
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValues[0]}
          onChange={handleMinChange}
          className="absolute w-full h-2 top-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-900 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:bg-slate-50 [&::-webkit-slider-thumb]:transition-colors [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-900 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:hover:bg-slate-50 [&::-moz-range-thumb]:transition-colors"
          aria-label={`${label} minimum value`}
        />

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValues[1]}
          onChange={handleMaxChange}
          className="absolute w-full h-2 top-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-900 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:bg-slate-50 [&::-webkit-slider-thumb]:transition-colors [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-900 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:hover:bg-slate-50 [&::-moz-range-thumb]:transition-colors"
          aria-label={`${label} maximum value`}
        />
      </div>
    </div>
  );
}
