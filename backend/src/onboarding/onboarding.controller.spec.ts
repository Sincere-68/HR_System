import 'reflect-metadata';
import { PERMISSIONS } from '@hr-demo/shared';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { OnboardingController } from './onboarding.controller';

describe('OnboardingController direct Offer routes', () => {
  const controller = new OnboardingController({} as never);

  it.each([
    'getInternOfferFormOptions',
    'createInternOffer',
    'getInternConversionOptions',
    'getInternConversionOfferPrefill',
  ])('protects %s with employee.create', (method) => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller[method as keyof OnboardingController])).toEqual([
      PERMISSIONS.EMPLOYEE_CREATE,
    ]);
  });

  it('keeps Offer list on employee.read and has no template controller methods', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller.findOffers)).toEqual([PERMISSIONS.EMPLOYEE_READ]);
    expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, controller.getInternConversionOfferPrefill)).toBeUndefined();
    expect(controller).not.toHaveProperty('getOffer' + 'Template');
    expect(controller).not.toHaveProperty('saveOffer' + 'Template');
  });
});
