// src/redux/airportsSlice.js
import { createSlice } from "@reduxjs/toolkit";

// Your original list centralized in Redux
const initialAirports = [
  { label: "กรุงเทพฯ - ดอนเมือง (DMK)", value: "DMK" },
  { label: "เชียงใหม่ (CNX)", value: "CNX" },
  { label: "ภูเก็ต (HKT)", value: "HKT" },
  { label: "หาดใหญ่ (็็HDY)", value: "HDY" },
  { label: "ตรัง (TST)", value: "TST" },
];

const airportsSlice = createSlice({
  name: "airports",
  initialState: {
    list: initialAirports,
  },
  reducers: {
    setAirports(state, action) {
      state.list = Array.isArray(action.payload) ? action.payload : state.list;
    },
    addAirport(state, action) {
      const ap = action.payload;
      if (ap && ap.value && !state.list.find(a => a.value === ap.value)) {
        state.list.push(ap);
      }
    },
    removeAirport(state, action) {
      const code = action.payload;
      state.list = state.list.filter(a => a.value !== code);
    },
  },
});

export const { setAirports, addAirport, removeAirport } = airportsSlice.actions;
export const selectAirports = (state) => state.airports.list;
export const selectAirportByValue = (code) => (state) =>
  state.airports.list.find(a => a.value === code);

export default airportsSlice.reducer;
