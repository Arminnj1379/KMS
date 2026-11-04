import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { IdentityService } from './identity.service';

@ApiTags('auth')
@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Self-service bootstrap: user + isolated organization' })
  register(@Body() dto: RegisterDto) {
    return this.identity.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Email + password login' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.identity.login(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate refresh token (reuse revokes the family)' })
  refresh(@Body() dto: RefreshDto) {
    return this.identity.refresh(dto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke one refresh session (idempotent)' })
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.identity.logout(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user + memberships' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.identity.me(user.userId);
  }

  @Patch('password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (revokes all sessions)' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.identity.changePassword(user.userId, dto);
  }
}
