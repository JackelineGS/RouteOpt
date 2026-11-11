#include "metrics.hpp"

#include <fstream>
#include <sstream>
#include <string>

static long read_status_kb(const std::string& key) {
    std::ifstream f("/proc/self/status");
    if (!f) return 0;
    std::string line;
    while (std::getline(f, line)) {
        if (line.rfind(key, 0) == 0) {
            std::istringstream iss(line.substr(key.size()));
            long kb = 0;
            iss >> kb;
            return kb;
        }
    }
    return 0;
}

long current_memory_kb() { return read_status_kb("VmRSS:"); }
long peak_memory_kb() { return read_status_kb("VmHWM:"); }

void reset_peak_memory() {
    std::ofstream f("/proc/self/clear_refs");
    if (f) f << "5";
}

