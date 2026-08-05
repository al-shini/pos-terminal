using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace PinPad_Utils;

public class KeysManager
{
	private RSACryptoServiceProvider _publicRsaKey;

	private RSACryptoServiceProvider _privateRsaKey;

	private const string PcRsaPassword = "09!@$njkgERKJJHDSPOOI";

	public void LoadTerminalRsaKeys()
	{
		_privateRsaKey = null;
		string text = File.ReadAllText(Path.Combine(Directory.GetCurrentDirectory(), "terminal_rsa_pub_key.txt"));
		if (!string.IsNullOrEmpty(text))
		{
			_publicRsaKey = new RSACryptoServiceProvider();
			_publicRsaKey.ImportSubjectPublicKeyInfo(Convert.FromBase64String(text), out var _);
		}
	}

	public void LoadPcRsaKeys()
	{
		byte[] array = Convert.FromBase64String(GetPcPrivPubKey().Item1);
		_privateRsaKey = new RSACryptoServiceProvider();
		_privateRsaKey.ImportEncryptedPkcs8PrivateKey("09!@$njkgERKJJHDSPOOI", array, out var bytesRead);
		_publicRsaKey = new RSACryptoServiceProvider();
		_publicRsaKey.ImportSubjectPublicKeyInfo(_privateRsaKey.ExportSubjectPublicKeyInfo(), out bytesRead);
	}

	public byte[] RsaEncryptionWithPublicKey(byte[] plainData, bool fOAEP = false)
	{
		return _publicRsaKey.Encrypt(plainData, fOAEP);
	}

	public byte[] RsaDecryptWithPrivateKey(byte[] decryptedData, bool fOAEP = false)
	{
		return _privateRsaKey.Decrypt(decryptedData, fOAEP);
	}

	public (string, string) GetPcPrivPubKey()
	{
		string path = Path.Combine(Directory.GetCurrentDirectory(), "pc_rsa_priv_key.txt");
		if (!File.Exists(path))
		{
			File.Create(path).Close();
		}
		string text = File.ReadAllText(path);
		if (string.IsNullOrEmpty(text))
		{
			GenratePcRsaKeys();
			text = File.ReadAllText(path);
		}
		_privateRsaKey = new RSACryptoServiceProvider();
		_privateRsaKey.ImportEncryptedPkcs8PrivateKey("09!@$njkgERKJJHDSPOOI", Convert.FromBase64String(text), out var bytesRead);
		_publicRsaKey = new RSACryptoServiceProvider();
		_publicRsaKey.ImportSubjectPublicKeyInfo(_privateRsaKey.ExportSubjectPublicKeyInfo(), out bytesRead);
		return (text, Convert.ToBase64String(_publicRsaKey.ExportSubjectPublicKeyInfo()));
	}

	public async Task<byte[]> DecryptDataAsync(byte[] decryptionKey, byte[] encryptedData, bool decryptKey = true)
	{
		if (decryptionKey == null)
		{
			return null;
		}
		using SymmetricAlgorithm symAlg = GetSymmetricAlgorithm();
		byte[] array = new byte[symAlg.Key.Length];
		_ = new byte[symAlg.IV.Length];
		Buffer.BlockCopy(decryptKey ? RsaDecryptWithPrivateKey(decryptionKey) : decryptionKey, 0, array, 0, array.Length);
		using ICryptoTransform decryptor = symAlg.CreateDecryptor(array, null);
		return await TransformData(encryptedData, decryptor).ConfigureAwait(continueOnCapturedContext: false);
	}

	public async Task<(byte[], byte[])> EncryptDataWithRandomKeyAsync(string plainData)
	{
		using SymmetricAlgorithm symAlg = GetSymmetricAlgorithm();
		byte[] plainKey = Utils.HexStrToBinArray(Utils.ArrayToHexStr(symAlg.Key) + Utils.ArrayToHexStr(symAlg.IV));
		return await EncryptDataAndKeyAsync(plainKey, plainData).ConfigureAwait(continueOnCapturedContext: false);
	}

	private async Task<(byte[], byte[])> EncryptDataAndKeyAsync(byte[] plainKey, string plainData)
	{
		using SymmetricAlgorithm symAlg = GetSymmetricAlgorithm();
		byte[] array = new byte[symAlg.Key.Length];
		byte[] array2 = new byte[symAlg.IV.Length];
		Buffer.BlockCopy(plainKey, 0, array, 0, array.Length);
		Buffer.BlockCopy(plainKey, array.Length, array2, 0, array2.Length);
		using ICryptoTransform encryptor = symAlg.CreateEncryptor(array, array2);
		byte[] item = await TransformData(Encoding.UTF8.GetBytes(plainData), encryptor).ConfigureAwait(continueOnCapturedContext: false);
		return (RsaEncryptionWithPublicKey(plainKey), item);
	}

	private static async Task<byte[]> TransformData(byte[] dataToCrypt, ICryptoTransform transform)
	{
		byte[] result;
		await using (MemoryStream msEncrypt = new MemoryStream())
		{
			byte[] array2;
			await using (CryptoStream csEncrypt = new CryptoStream(msEncrypt, transform, CryptoStreamMode.Write))
			{
				await csEncrypt.WriteAsync(dataToCrypt).ConfigureAwait(continueOnCapturedContext: false);
				csEncrypt.Close();
				byte[] array = msEncrypt.ToArray();
				array2 = array;
			}
			result = array2;
		}
		return result;
	}

	private static SymmetricAlgorithm GetSymmetricAlgorithm()
	{
		Aes aes = Aes.Create();
		aes.Mode = CipherMode.ECB;
		aes.Padding = PaddingMode.PKCS7;
		aes.KeySize = 256;
		return aes;
	}

	private void GenratePcRsaKeys()
	{
		using RSACryptoServiceProvider rSACryptoServiceProvider = new RSACryptoServiceProvider(4096);
		string contents = Convert.ToBase64String(rSACryptoServiceProvider.ExportEncryptedPkcs8PrivateKey("09!@$njkgERKJJHDSPOOI", new PbeParameters(PbeEncryptionAlgorithm.Aes256Cbc, HashAlgorithmName.SHA256, 1000)));
		Convert.ToBase64String(rSACryptoServiceProvider.ExportSubjectPublicKeyInfo());
		File.WriteAllText(Path.Combine(Directory.GetCurrentDirectory(), "pc_rsa_priv_key.txt"), contents);
	}
}
