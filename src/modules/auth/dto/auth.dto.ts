import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
export class RegisterDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() profession?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsString() referralCode?: string;
}
export class LoginDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() @IsNotEmpty() password!: string;
}
export class FirebaseLoginDto {
  @IsString() @IsNotEmpty() idToken!: string;
  @IsOptional() @IsString() referralCode?: string;
}
export class CompleteProfileDto {
  @IsString() @IsNotEmpty() fullName!: string;
  @IsString() @IsNotEmpty() address!: string;
  @IsString() @IsNotEmpty() profession!: string;
  @IsOptional() @IsString() photoUrl?: string;
}
export class UpdateMeDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() profession?: string;
  @IsOptional() @IsString() photoUrl?: string;
}
