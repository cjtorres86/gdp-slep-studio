import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  usuario = '';
  contrasena = '';
  verClave = false;
  enviando = false;
  error: string | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  ingresar(): void {
    if (this.enviando) return;
    if (!this.usuario.trim() || !this.contrasena) {
      this.error = 'Escribe tu usuario y tu contraseña.';
      return;
    }
    this.error = null;
    this.enviando = true;
    this.auth.login(this.usuario.trim(), this.contrasena).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: HttpErrorResponse) => {
        this.enviando = false;
        // status 0 = ni siquiera llegó al servidor. Con el servidor
        // gratuito de Render, la primera visita tras un rato sin uso puede
        // tardar hasta un minuto en despertar: se le avisa a la persona.
        this.error =
          err.status === 0
            ? 'No se pudo conectar con el servidor. Si el sistema estuvo un tiempo sin uso, espera un minuto y vuelve a intentar.'
            : typeof err.error?.message === 'string'
              ? err.error.message
              : 'No se pudo ingresar. Intenta nuevamente.';
      },
    });
  }
}
