import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the pipeline demo heading', () => {
  render(<App />);
  const headingElement = screen.getByText(/React CI\/CD Pipeline Demo/i);
  expect(headingElement).toBeInTheDocument();
});
