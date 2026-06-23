using Microsoft.AspNetCore.Identity;

namespace PresetApi.Auth;

/// <summary>
/// Rejects excessively long passwords. Identity has a minimum-length option but
/// no maximum; capping length bounds the cost of password hashing (a very long
/// password is a CPU-DoS vector). Runs anywhere Identity validates a password
/// (registration, change, reset).
/// </summary>
public class MaxLengthPasswordValidator<TUser> : IPasswordValidator<TUser>
    where TUser : class
{
    private const int MaxLength = 128;

    public Task<IdentityResult> ValidateAsync(
        UserManager<TUser> manager,
        TUser user,
        string? password)
    {
        if (password is { Length: > MaxLength })
        {
            return Task.FromResult(
                IdentityResult.Failed(new IdentityError
                {
                    Code = "PasswordTooLong",
                    Description = $"Passwords must be at most {MaxLength} characters.",
                }));
        }

        return Task.FromResult(IdentityResult.Success);
    }
}
