import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'سارا رضایی' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'sara@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Secret123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'گذرواژه باید حداقل شامل یک حرف و یک عدد باشد',
  })
  password!: string;

  @ApiProperty({ example: 'شرکت نمونه' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationName!: string;
}
