import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function ExportInstructions() {
  return (
    <Accordion className="w-full">
      <AccordionItem value="how-to-export">
        <AccordionTrigger className="text-sm">
          How do I export a chat as a file?
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Only export conversations you&apos;re comfortable making part of your profile —
            pick specific threads, not your whole history.
          </p>

          <div>
            <p className="font-medium text-foreground">Using Claude Code?</p>
            <p>Run this in your project&apos;s terminal, pick a session by number, and it saves a file to your Desktop:</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 text-xs">
              <code>npm run export-chat</code>
            </pre>
            <p>Then upload the file it saved.</p>
            <p className="mt-1">
              Kept working in the same chat? Run it again and choose &quot;Only the new part&quot; —
              you get a separate file with just the new work, ready for another slot.
            </p>
          </div>

          <div>
            <p className="font-medium text-foreground">Any other AI chat</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Open the conversation you want to share.</li>
              <li>Click into the chat and select all the text (Cmd/Ctrl+A), then copy it.</li>
              <li>Paste it into a plain text editor (Notes, TextEdit, Notepad).</li>
              <li>Save the file with a <code>.txt</code> extension.</li>
              <li>Upload that file below.</li>
            </ol>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
