import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../iam/api/auth.guard';
import { CustomerProfileService } from '../application/customer-profile.service';
@Controller('addresses')
export class AddressController {
  constructor(private readonly profile: CustomerProfileService) {}
  @Get() list(@Req() req: AuthenticatedRequest) {
    return this.profile.listAddresses(req.user!.id);
  }
}
