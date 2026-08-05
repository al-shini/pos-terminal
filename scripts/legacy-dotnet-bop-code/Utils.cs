using System;
using System.Globalization;
using System.Linq;
using System.Text;

namespace PinPad_Utils;

public class Utils
{
	private const string Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

	private static readonly Random _random = new Random();

	public static string ArrayToHexStr(byte[] input)
	{
		return ArrayToHexStr(input, 0, input.Length);
	}

	public static string ArrayToHexStr(byte[] input, int start, int len)
	{
		if (start + len > input.Length)
		{
			return "";
		}
		StringBuilder stringBuilder = new StringBuilder();
		int num = start + len;
		for (int i = start; i < num; i++)
		{
			stringBuilder.Append(input[i].ToString("X2", CultureInfo.InvariantCulture));
		}
		return stringBuilder.ToString();
	}

	public static byte[] HexStrToBinArray(string sBuffer)
	{
		StringBuilder stringBuilder = new StringBuilder(sBuffer.Length);
		sBuffer = sBuffer.ToUpperInvariant();
		int length = sBuffer.Length;
		int num = 0;
		while (num < length)
		{
			char c = sBuffer[num++];
			if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F'))
			{
				stringBuilder.Append(c);
			}
		}
		if ((stringBuilder.Length & 1) != 0)
		{
			throw new ArgumentException("Buffer has odd hex digits. Please check and retry");
		}
		length = stringBuilder.Length;
		byte[] array = new byte[(length + 1) / 2];
		char[] array2 = new char[2];
		for (num = 0; num < length; num += 2)
		{
			array2[0] = stringBuilder[num];
			array2[1] = stringBuilder[num + 1];
			sBuffer = new string(array2);
			array[num / 2] = Convert.ToByte(sBuffer, 16);
		}
		return array;
	}

	public static string RandomString(int length)
	{
		return new string((from s in Enumerable.Repeat("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", length)
			select s[_random.Next(s.Length)]).ToArray());
	}
}
