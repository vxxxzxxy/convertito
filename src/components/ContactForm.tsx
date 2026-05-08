import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const CONTACT_EMAIL = 'hola@convertito.app';

const subjects = [
  'Reportar un problema',
  'Sugerir una mejora',
  'Un formato no funciona',
  'Privacidad o seguridad',
  'Otro',
];

export function ContactForm() {
  const [subject, setSubject] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <form
      className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const name = String(form.get('name') ?? '').trim();
        const email = String(form.get('email') ?? '').trim();
        const message = String(form.get('message') ?? '').trim();
        const selectedSubject = subject || 'Contacto Convertito';
        const body = [
          `Nombre: ${name || 'No indicado'}`,
          `Email: ${email || 'No indicado'}`,
          `Asunto: ${selectedSubject}`,
          '',
          message,
        ].join('\n');

        window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
          selectedSubject,
        )}&body=${encodeURIComponent(body)}`;
        setSent(true);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nombre
          </Label>
          <Input
            id="contact-name"
            name="name"
            placeholder="Tu nombre"
            autoComplete="name"
            className="h-11 rounded-lg border-border bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Email
          </Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            placeholder="tu@email.com"
            autoComplete="email"
            required
            className="h-11 rounded-lg border-border bg-background"
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="contact-subject" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Asunto
        </Label>
        <Select value={subject} onValueChange={setSubject} required>
          <SelectTrigger
            id="contact-subject"
            className="h-11 w-full rounded-lg border-border bg-background"
          >
            <SelectValue placeholder="Selecciona una opción" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="contact-message" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Mensaje
        </Label>
        <Textarea
          id="contact-message"
          name="message"
          placeholder="Cuéntame qué ocurrió, qué formato usaste y en qué navegador."
          required
          className="min-h-36 resize-y rounded-lg border-border bg-background"
        />
      </div>

      <Button type="submit" size="lg" className="mt-6 h-11 w-full rounded-lg">
        Enviar reporte
        <Send aria-hidden="true" />
      </Button>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Se abrirá tu cliente de correo con el mensaje listo para enviar.
      </p>
      {sent && (
        <p className="mt-2 text-center text-xs text-primary" aria-live="polite">
          Correo preparado. Revísalo y envíalo desde tu app de correo.
        </p>
      )}
    </form>
  );
}
