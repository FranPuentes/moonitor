
clean:
	find . -name \*~ -delete
	rm -f *.log
	rm -f *.pid

pull:
	git pull

commit: clean
	git commit -a

tgz:
	tar czvf moon-broker.tgz broker moon-broker.js common modules deps web
	tar czvf moon-daemon.tgz daemon moon-daemon.js common plugins deps

push: tgz commit
	git push https://github.com/FranPuentes/moonitor.git


