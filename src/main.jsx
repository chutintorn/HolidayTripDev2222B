import React from 'react';
import ReactDOM from 'react-dom/client';

// ✅ Import RSuite CSS FIRST so your Tailwind overrides come after
import 'rsuite/dist/rsuite.min.css';

// ✅ Then import your Tailwind / custom CSS
import './index.css';

import { Provider } from 'react-redux';
import { store } from './redux/store';

import { BrowserRouter } from 'react-router-dom';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
