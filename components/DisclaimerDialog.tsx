'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DisclaimerDialogProps {
  open: boolean;
  onAccept: () => void;
}

export function DisclaimerDialog({ open, onAccept }: DisclaimerDialogProps) {
  const handleAccept = () => {
    localStorage.setItem('disclaimer-accepted', 'true');
    onAccept();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="w-full h-full max-w-full max-h-full md:max-w-2xl md:max-h-[90vh] md:h-auto bg-black border-0 md:border-2 rounded-none md:border-white/50 text-white overflow-y-auto z-[9999] p-6 md:p-8 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3 mb-2">
          <DialogTitle className="text-2xl font-bold text-white">
            IMPORTANT DISCLAIMER
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Please read and accept the following terms before proceeding
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2 text-sm text-gray-300 leading-relaxed">
          <p>
            THE AGORÁX CONTRACT, SUPPORTING WEBSITES, AND ALL OTHER INTERFACES (THE SOFTWARE) IS PROVIDED &quot;AS IS&quot; AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
          </p>

          <p>
            BY INTERACTING WITH THE SOFTWARE YOU ARE ASSERTING THAT YOU BEAR ALL THE RISKS ASSOCIATED WITH DOING SO. AN INFINITE NUMBER OF UNPREDICTABLE THINGS MAY OCCUR WHICH COULD POTENTIALLY RESULT IN LOSS AND FAILURE, AND BY INTERACTING WITH THE SOFTWARE YOU ARE ASSERTING THAT YOU AGREE THERE IS NO RECOURSE AVAILABLE AND YOU WILL NOT SEEK IT.
          </p>

          <p>
            INTERACTING WITH THE SOFTWARE IS NOT AN INVESTMENT AND SHALL NOT BE CONSIDERED A SHARED ENTERPRISE.
          </p>

          <p>
            REGARDING AGORÁX, YOU SHALL HAVE NO EXPECTATION OF PROFIT OR ANY TYPE OF SUCCESS FROM THE WORK OF OTHER PEOPLE.
          </p>
        </div>

        <DialogFooter className="mt-6">
          <Button
            onClick={handleAccept}
            className="w-full py-6 text-lg font-semibold bg-white text-black hover:bg-gray-200"
          >
            Accept and Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
