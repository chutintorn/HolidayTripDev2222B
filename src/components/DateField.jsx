import { DatePicker } from "rsuite";

/**
 * Reusable RSuite DatePicker that speaks yyyy-mm-dd strings to your form.
 */
export default function DateField({
  value,          // string "yyyy-mm-dd" or null
  onChange,       // (strOrNull) => void
  minDate,        // string "yyyy-mm-dd" | null
  maxDate,        // string "yyyy-mm-dd" | null
  placeholder = "YYYY-MM-DD",
  className = "",
}) {
  const toDate = (s) => (s ? new Date(s + "T00:00:00") : null);
  const fromDate = (d) => (d ? d.toISOString().slice(0, 10) : null);

  const min = toDate(minDate || null);
  const max = toDate(maxDate || null);

  return (
    <DatePicker
      oneTap
      size="lg"
      format="yyyy-MM-dd"
      placeholder={placeholder}
      value={toDate(value)}
      onChange={(d) => onChange(fromDate(d))}
      disabledDate={(d) => {
        if (!d) return false;
        if (min && d < min) return true;
        if (max && d > max) return true;
        return false;
      }}
      className={className || "ibe-datepicker"}
      style={{ width: "100%" }}
    />
  );
}
