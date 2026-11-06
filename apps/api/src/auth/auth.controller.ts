import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SelectTenantDto } from './dto/select-tenant.dto';
import type { AuthenticatedRequestUser, AuthResponse } from './auth.types';

const REFRESH_COOKIE = 'invoice_refresh';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.register(dto);
    this.setRefreshCookie(response, result.refreshToken);
    return result.response;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(response, result.refreshToken);
    return result.response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.refresh(this.readRefreshCookie(request));
    this.setRefreshCookie(response, result.refreshToken);
    return result.response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.readRefreshCookie(request));
    response.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
  }

  @Post('tenant')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async selectTenant(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: SelectTenantDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.selectTenant(
      user,
      dto.tenantId,
      this.readRefreshCookie(request),
    );
    this.setRefreshCookie(response, result.refreshToken);
    return result.response;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getCurrentSession(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<{
    user: AuthResponse['user'];
    memberships: AuthResponse['memberships'];
    activeTenant: AuthResponse['activeTenant'];
  }> {
    return this.authService.getCurrentSession(user);
  }

  private readRefreshCookie(request: Request): string {
    const cookie = request.headers.cookie
      ?.split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${REFRESH_COOKIE}=`));

    if (!cookie) {
      return '';
    }

    return cookie.slice(REFRESH_COOKIE.length + 1);
  }

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie(REFRESH_COOKIE, token, {
      ...this.refreshCookieOptions(),
      maxAge: this.authService.refreshTokenMaxAgeMs,
    });
  }

  private refreshCookieOptions(): {
    httpOnly: true;
    sameSite: 'lax';
    secure: boolean;
    path: string;
  } {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth',
    };
  }
}
