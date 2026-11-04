import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'گذرواژه حداقل ۸ نویسه است')
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'گذرواژه باید حداقل شامل یک حرف و یک عدد باشد');

export const loginSchema = z.object({
  email: z.string().email('رایانامه معتبر نیست'),
  password: z.string().min(1, 'گذرواژه الزامی است'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().min(2, 'نام حداقل ۲ نویسه است').max(120),
    email: z.string().email('رایانامه معتبر نیست'),
    password: passwordSchema,
    confirmPassword: z.string(),
    organizationName: z.string().min(2, 'نام سازمان حداقل ۲ نویسه است').max(120),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'تکرار گذرواژه مطابقت ندارد',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'گذرواژه فعلی الزامی است'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'تکرار گذرواژه مطابقت ندارد',
    path: ['confirmPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const inviteSchema = z.object({
  fullName: z.string().min(2, 'نام حداقل ۲ نویسه است').max(120),
  email: z.string().email('رایانامه معتبر نیست'),
  password: passwordSchema,
  role: z.enum(['org-admin', 'member']),
});

export type InviteInput = z.infer<typeof inviteSchema>;
