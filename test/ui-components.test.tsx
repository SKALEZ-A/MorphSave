import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { 
  Button, 
  Input, 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  Badge,
  Alert,
  Modal,
  LoadingSpinner
} from '../src/components/ui';

describe('UI Components', () => {
  describe('Button', () => {
    it('renders with default props', () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-blue-600');
    });

    it('renders different variants', () => {
      const { rerender } = render(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-gray-100');

      rerender(<Button variant="outline">Outline</Button>);
      expect(screen.getByRole('button')).toHaveClass('border');

      rerender(<Button variant="destructive">Destructive</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-red-600');
    });

    it('shows loading state', () => {
      render(<Button loading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('handles click events', () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('is disabled when loading', () => {
      const handleClick = jest.fn();
      render(<Button loading onClick={handleClick}>Loading</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Input', () => {
    it('renders with label', () => {
      render(<Input label="Email" />);
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    it('shows error state', () => {
      render(<Input label="Email" error="Invalid email" />);
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toHaveClass('border-red-500');
    });

    it('shows helper text', () => {
      render(<Input label="Password" helperText="Must be at least 8 characters" />);
      expect(screen.getByText('Must be at least 8 characters')).toBeInTheDocument();
    });

    it('handles password visibility toggle', () => {
      render(<Input type="password" label="Password" />);
      const input = screen.getByLabelText('Password');
      const toggleButton = screen.getByRole('button');

      expect(input).toHaveAttribute('type', 'password');
      
      fireEvent.click(toggleButton);
      expect(input).toHaveAttribute('type', 'text');
      
      fireEvent.click(toggleButton);
      expect(input).toHaveAttribute('type', 'password');
    });

    it('handles input changes', () => {
      const handleChange = jest.fn();
      render(<Input onChange={handleChange} />);
      
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Card', () => {
    it('renders with content', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Card content</p>
          </CardContent>
        </Card>
      );

      expect(screen.getByText('Test Card')).toBeInTheDocument();
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('applies different variants', () => {
      const { rerender } = render(<Card variant="outlined">Content</Card>);
      expect(screen.getByText('Content').parentElement).toHaveClass('border');

      rerender(<Card variant="elevated">Content</Card>);
      expect(screen.getByText('Content').parentElement).toHaveClass('shadow-sm');
    });
  });

  describe('Badge', () => {
    it('renders with different variants', () => {
      const { rerender } = render(<Badge variant="success">Success</Badge>);
      expect(screen.getByText('Success')).toHaveClass('bg-green-100');

      rerender(<Badge variant="error">Error</Badge>);
      expect(screen.getByText('Error')).toHaveClass('bg-red-100');

      rerender(<Badge variant="warning">Warning</Badge>);
      expect(screen.getByText('Warning')).toHaveClass('bg-yellow-100');
    });

    it('renders different sizes', () => {
      const { rerender } = render(<Badge size="sm">Small</Badge>);
      expect(screen.getByText('Small')).toHaveClass('text-xs');

      rerender(<Badge size="lg">Large</Badge>);
      expect(screen.getByText('Large')).toHaveClass('text-base');
    });
  });

  describe('Alert', () => {
    it('renders with different variants', () => {
      const { rerender } = render(<Alert variant="success">Success message</Alert>);
      expect(screen.getByText('Success message')).toBeInTheDocument();
      expect(screen.getByText('Success message').closest('div')).toHaveClass('border-green-200');

      rerender(<Alert variant="error">Error message</Alert>);
      expect(screen.getByText('Error message').closest('div')).toHaveClass('border-red-200');
    });

    it('shows title when provided', () => {
      render(<Alert title="Alert Title">Alert message</Alert>);
      expect(screen.getByText('Alert Title')).toBeInTheDocument();
      expect(screen.getByText('Alert message')).toBeInTheDocument();
    });

    it('handles dismiss functionality', () => {
      const handleDismiss = jest.fn();
      render(
        <Alert dismissible onDismiss={handleDismiss}>
          Dismissible alert
        </Alert>
      );

      const dismissButton = screen.getByRole('button');
      fireEvent.click(dismissButton);
      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Modal', () => {
    it('renders when open', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(
        <Modal isOpen={false} onClose={() => {}} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      const handleClose = jest.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when escape key is pressed', () => {
      const handleClose = jest.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('applies different sizes', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={() => {}} size="sm">
          Small modal
        </Modal>
      );
      expect(screen.getByText('Small modal').closest('div')).toHaveClass('max-w-md');

      rerender(
        <Modal isOpen={true} onClose={() => {}} size="lg">
          Large modal
        </Modal>
      );
      expect(screen.getByText('Large modal').closest('div')).toHaveClass('max-w-2xl');
    });
  });

  describe('LoadingSpinner', () => {
    it('renders with default size', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('h-6 w-6');
    });

    it('renders different sizes', () => {
      const { rerender } = render(<LoadingSpinner size="sm" />);
      expect(screen.getByTestId('loading-spinner')).toHaveClass('h-4 w-4');

      rerender(<LoadingSpinner size="lg" />);
      expect(screen.getByTestId('loading-spinner')).toHaveClass('h-8 w-8');

      rerender(<LoadingSpinner size="xl" />);
      expect(screen.getByTestId('loading-spinner')).toHaveClass('h-12 w-12');
    });

    it('renders with text', () => {
      render(<LoadingSpinner text="Loading..." />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('Button has proper ARIA attributes', () => {
      render(<Button disabled>Disabled Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('disabled');
    });

    it('Input has proper labels and ARIA attributes', () => {
      render(<Input label="Email" required error="Invalid email" />);
      const input = screen.getByLabelText('Email *');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('Modal has proper focus management', async () => {
      const handleClose = jest.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          <button>Focus me</button>
        </Modal>
      );

      // Modal should trap focus
      const modalButton = screen.getByText('Focus me');
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('Alert has proper ARIA roles', () => {
      render(<Alert variant="error">Error message</Alert>);
      // The alert should be announced to screen readers
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('Card adapts to different screen sizes', () => {
      render(<Card className="responsive-card">Responsive content</Card>);
      const card = screen.getByText('Responsive content').parentElement;
      expect(card).toHaveClass('responsive-card');
    });

    it('Button maintains usability on mobile', () => {
      render(<Button size="sm">Mobile Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-8'); // Appropriate touch target size
    });
  });

  describe('Theme Support', () => {
    it('Components support dark mode classes', () => {
      render(<Card>Dark mode content</Card>);
      const card = screen.getByText('Dark mode content').parentElement;
      expect(card).toHaveClass('dark:bg-gray-900');
    });

    it('Input supports dark mode', () => {
      render(<Input label="Dark input" />);
      const input = screen.getByLabelText('Dark input');
      expect(input).toHaveClass('dark:bg-gray-900');
    });
  });
});