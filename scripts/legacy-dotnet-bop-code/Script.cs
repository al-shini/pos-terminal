using System;
using System.IO;
using System.IO.Ports;
using System.Text;
using System.Text.Json;
using System.Threading;
using PinPad_Utils;

class Program
{
    static void Main()
    {
        try
        {
            string comPort = "COM1"; // Change to COM4 if needed

            KeysManager keysManager = new KeysManager();

            string publicKey = keysManager.GetPcPrivPubKey().Item2;

            string initJson =
                $"{{\"lang\":0,\"print\":3,\"rsaPubKey\":\"{publicKey}\",\"type\":\"INIT\"}}";

            string packet =
                $"~PCNC~{initJson.Length:D4}~{initJson}";

            Console.WriteLine("INIT JSON Length: " + initJson.Length);
            Console.WriteLine("Packet:");
            Console.WriteLine(packet);
            Console.WriteLine();

            string response = SendSerialLikeDll(comPort, packet);

            Console.WriteLine();
            Console.WriteLine("========== FINAL RESPONSE ==========");
            Console.WriteLine(response);
            Console.WriteLine("====================================");

            SaveTerminalPublicKey(response);

            Console.WriteLine();
            Console.WriteLine("Finished.");
            Console.ReadKey();
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR:");
            Console.WriteLine(ex.ToString());
            Console.ReadKey();
        }
    }

    static string SendSerialLikeDll(string comPort, string packet)
    {
        using SerialPort port = new SerialPort(comPort)
        {
            BaudRate = 115200,
            DataBits = 8,
            Parity = Parity.None,
            StopBits = StopBits.One,
            Handshake = Handshake.None,
            ReadTimeout = 90000,
            WriteTimeout = 90000,
            Encoding = Encoding.ASCII
        };

        port.Open();

        Console.WriteLine("Port opened: " + comPort);

        Console.WriteLine("Sending rubbish data first...");
        port.Write("rubbish data");

        string ignored = "";
        int flushTry = 3;

        do
        {
            Thread.Sleep(1000);

            string part = port.ReadExisting();

            if (!string.IsNullOrEmpty(part))
            {
                ignored += part;

                Console.WriteLine("Ignored handshake data:");
                Console.WriteLine(part);
            }
        }
        while ((string.IsNullOrEmpty(ignored) || !ignored.EndsWith("}")) && --flushTry >= 0);

        Console.WriteLine();
        Console.WriteLine("Handshake/flush done.");
        Console.WriteLine("Sending real INIT request...");

        port.Write(packet);

        Console.WriteLine("Please wait for response...");

        string response = "";
        int waitCount = 110;

        do
        {
            try
            {
                string part = port.ReadExisting();

                if (!string.IsNullOrEmpty(part))
                {
                    response += part;

                    Console.WriteLine("Received part:");
                    Console.WriteLine(part);
                }
                else
                {
                    Thread.Sleep(1000);
                    Console.WriteLine("NO DATA " + waitCount);
                }

                if (!string.IsNullOrEmpty(response) && !response.EndsWith("}"))
                {
                    Thread.Sleep(1000);
                    Console.WriteLine("Waiting more data...");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("EXCEPTION: " + ex.Message);
            }
        }
        while ((string.IsNullOrEmpty(response) || !response.EndsWith("}")) && --waitCount >= 0);

        port.Close();

        return response;
    }

    static void SaveTerminalPublicKey(string response)
    {
        if (string.IsNullOrWhiteSpace(response))
        {
            Console.WriteLine("Empty response. Cannot save terminal key.");
            return;
        }

        int jsonStart = response.IndexOf('{');

        if (jsonStart < 0)
        {
            Console.WriteLine("No JSON object found in response.");
            Console.WriteLine("Raw response:");
            Console.WriteLine(response);
            return;
        }

        string json = response.Substring(jsonStart);

        using JsonDocument doc = JsonDocument.Parse(json);

        if (doc.RootElement.TryGetProperty("rsaPubKey", out JsonElement rsaPubKeyElement))
        {
            string terminalPublicKey = rsaPubKeyElement.GetString();

            if (!string.IsNullOrWhiteSpace(terminalPublicKey))
            {
                File.WriteAllText("terminal_rsa_pub_key.txt", terminalPublicKey);

                Console.WriteLine("Terminal RSA public key saved to terminal_rsa_pub_key.txt");
            }
            else
            {
                Console.WriteLine("rsaPubKey is empty.");
            }
        }
        else
        {
            Console.WriteLine("Response does not contain rsaPubKey.");
            Console.WriteLine("Raw response:");
            Console.WriteLine(response);
        }
    }
}